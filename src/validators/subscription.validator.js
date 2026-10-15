import { z } from "zod";
import { objectId, paginationQuerySchema } from "./common.validator.js";

export const channelIdParamsSchema = z.object({ channelId: objectId("channel id") });
export const subscriptionListQuerySchema = paginationQuerySchema;