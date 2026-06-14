#!/usr/bin/env bash

set -euo pipefail

stage="${1:-}"
hosted_zone_id="${2:-}"

if [[ ! "$stage" =~ ^pr-[0-9]+$ ]]; then
  echo "Expected preview stage like pr-123, got: $stage" >&2
  exit 1
fi

if [[ -z "$hosted_zone_id" ]]; then
  echo "Missing hosted zone id" >&2
  exit 1
fi

for required_command in aws jq; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Missing required command: $required_command" >&2
    exit 1
  fi
done

record_changes_file="$(mktemp)"
trap 'rm -f "$record_changes_file"' EXIT

domain_name="${stage}.preview.slop-o-meter.dev."

aws route53 list-resource-record-sets --hosted-zone-id "$hosted_zone_id" \
  | jq --arg domain_name "$domain_name" '
      {
        Changes: [
          .ResourceRecordSets[]
          | select(.Type == "CNAME")
          | select(.Name | endswith($domain_name))
          | select(any(.ResourceRecords[]?; .Value | endswith(".acm-validations.aws.")))
          | { Action: "DELETE", ResourceRecordSet: . }
        ]
      }
    ' > "$record_changes_file"

record_change_count="$(jq ".Changes | length" "$record_changes_file")"

if [[ "$record_change_count" -gt 0 ]]; then
  change_id="$(
    aws route53 change-resource-record-sets \
      --hosted-zone-id "$hosted_zone_id" \
      --change-batch "file://$record_changes_file" \
      --query "ChangeInfo.Id" \
      --output text
  )"
  aws route53 wait resource-record-sets-changed --id "$change_id"
fi

for region in eu-central-1 us-east-1; do
  aws logs describe-log-groups \
    --region "$region" \
    --log-group-name-prefix "/aws/lambda/SlopOMeter-${stage}" \
    --query "logGroups[].logGroupName" \
    --output text \
    | tr "\t" "\n" \
    | sed "/^$/d" \
    | while IFS= read -r log_group_name; do
        aws logs delete-log-group \
          --region "$region" \
          --log-group-name "$log_group_name"
      done
done

echo "Deleted $record_change_count ACM validation record(s) for $stage."
