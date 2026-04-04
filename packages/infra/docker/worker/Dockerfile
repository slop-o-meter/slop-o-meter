FROM --platform=linux/arm64 public.ecr.aws/lambda/nodejs:24

RUN dnf install -y git && dnf clean all

COPY index.mjs ${LAMBDA_TASK_ROOT}/index.mjs

CMD ["index.handler"]
