import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import S3ProjectRepository from "../requirement-implementations/S3ProjectRepository/S3ProjectRepository.js";
import type { MeasurementMessage } from "../requirements/MeasurementQueue.js";
import runMeasurement from "./runMeasurement.js";

interface SqsEvent {
  Records: { body: string }[];
}

const projectRepository = new S3ProjectRepository(
  process.env.DATA_BUCKET_NAME!,
);

const cloudFrontClient = new CloudFrontClient({});

export const handler = async (event: SqsEvent): Promise<void> => {
  for (const record of event.Records) {
    const message: MeasurementMessage = JSON.parse(record.body);
    await runMeasurement(projectRepository, message.owner, message.repo);
    await invalidateProjectPage(message.owner, message.repo);
  }
};

async function invalidateProjectPage(
  owner: string,
  repo: string,
): Promise<void> {
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
  if (!distributionId) {
    return;
  }
  await cloudFrontClient.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `${owner}/${repo}/${Date.now()}`,
        Paths: {
          Quantity: 2,
          Items: [
            `/${owner}/${repo}`,
            `/api/project/${owner}/${repo}/measurement-data`,
          ],
        },
      },
    }),
  );
}
