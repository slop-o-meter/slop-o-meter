export const DOMAIN_NAME = "slop-o-meter.dev";

export function domainName(stage: string): string {
  if (stage === "production") {
    return DOMAIN_NAME;
  }
  return `${stage}.preview.${DOMAIN_NAME}`;
}
