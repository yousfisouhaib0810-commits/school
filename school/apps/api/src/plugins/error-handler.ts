import { FastifyPluginAsync, FastifyError } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error: FastifyError | Error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Validation error",
        details: error.flatten().fieldErrors,
      });
    }

    if (error.name === "PrismaClientKnownRequestError") {
      const e = error as unknown as { code?: string };
      if (e.code === "P2002") {
        return reply.status(409).send({ error: "Conflict: Resource already exists" });
      }
      return reply.status(400).send({ error: "Database request error" });
    }

    if ("statusCode" in error && typeof error.statusCode === "number") {
      return reply.status(error.statusCode).send({
        error: error.message || "Request error",
      });
    }

    fastify.log.error(error);
    return reply.status(500).send({ error: "Internal server error" });
  });
};

export default fp(errorHandlerPlugin);
