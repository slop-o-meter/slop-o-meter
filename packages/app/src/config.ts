import { GetParametersByPathCommand, SSMClient } from "@aws-sdk/client-ssm";

interface Config {
  githubToken: string;
  openrouterApiKey: string;
  openrouterModel: string;
  openrouterBaseUrl: string;
}

let cached: Config | null = null;

export default async function getConfig(): Promise<Config> {
  if (cached) {
    return cached;
  }

  const prefix = process.env.SSM_PARAMETER_PREFIX;
  if (!prefix) {
    return {
      githubToken: process.env.GITHUB_TOKEN ?? "",
      openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
      openrouterModel:
        process.env.OPENROUTER_MODEL ?? "google/gemini-3.1-pro-preview",
      openrouterBaseUrl:
        process.env.OPENROUTER_BASE_URL ??
        "https://openrouter.ai/api/v1/responses",
    };
  }

  const ssmClient = new SSMClient({});
  const result = await ssmClient.send(
    new GetParametersByPathCommand({
      Path: prefix,
      WithDecryption: true,
    }),
  );

  const parameters = new Map(
    (result.Parameters ?? []).map((parameter) => [
      parameter.Name!,
      parameter.Value!,
    ]),
  );

  cached = {
    githubToken: parameters.get(`${prefix}/github-token`) ?? "",
    openrouterApiKey: parameters.get(`${prefix}/openrouter-api-key`) ?? "",
    openrouterModel:
      parameters.get(`${prefix}/openrouter-model`) ??
      "google/gemini-3.1-pro-preview",
    openrouterBaseUrl:
      parameters.get(`${prefix}/openrouter-base-url`) ??
      "https://openrouter.ai/api/v1/responses",
  };

  return cached;
}
