import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { createOpenAPIGenerator } from "./openapi";
import { ServiceDescription } from "@weegigs/events-core";

// Enable OpenAPI extensions
extendZodWithOpenApi(z);

// Simple test schema
const TestEntity = z.object({
  id: z.string().openapi({
    description: "Entity identifier",
    example: "test-123"
  }),
  name: z.string().openapi({
    description: "Entity name",
    example: "Test Entity"
  }),
  value: z.number().openapi({
    description: "Entity value",
    example: 42
  })
}).openapi({
  title: "TestEntity",
  description: "A simple test entity"
});

const TestCommand = z.object({
  newValue: z.number().openapi({
    description: "New value to set",
    example: 100
  })
}).openapi({
  title: "UpdateValueCommand",
  description: "Update the entity value"
});

// Mock service description
const createTestServiceDescription = () => {
  return {
    info: () => ({
      title: "Test Service",
      version: "1.0.0",
      description: "A test service for OpenAPI generation",
      entity: {
        type: "test",
        schema: TestEntity
      }
    }),
    commands: () => ({
      "update-value": TestCommand
    })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ServiceDescription<any, any>;
};

describe("OpenAPI Generator", () => {
  it("should generate valid OpenAPI schema", () => {
    const serviceDescription = createTestServiceDescription();
    const generator = createOpenAPIGenerator(serviceDescription);
    
    const schema = generator.generateOpenAPISchema();
    
    // Basic structure validation
    expect(schema).toBeDefined();
    expect(schema.openapi).toBe("3.1.0");
    expect(schema.info).toBeDefined();
    expect(schema.info.title).toBe("Test Service");
    expect(schema.info.version).toBe("1.0.0");
    expect(schema.info.description).toBe("A test service for OpenAPI generation");
    
    // Check paths exist
    expect(schema.paths).toBeDefined();
    expect(schema.paths?.["/test/{id}"]).toBeDefined();
    expect(schema.paths?.["/test/{id}"]?.["get"]).toBeDefined();
    expect(schema.paths?.["/test/{id}/update-value"]).toBeDefined();
    expect(schema.paths?.["/test/{id}/update-value"]?.["post"]).toBeDefined();
    
    // Check components exist
    expect(schema.components).toBeDefined();
    expect(schema.components?.schemas).toBeDefined();
    expect(schema.components?.schemas?.["TestState"]).toBeDefined();
    expect(schema.components?.schemas?.["TestResponse"]).toBeDefined();
    expect(schema.components?.schemas?.["UpdateValueCommand"]).toBeDefined();
    expect(schema.components?.schemas?.["AggregateId"]).toBeDefined();
    expect(schema.components?.schemas?.["Revision"]).toBeDefined();
    expect(schema.components?.schemas?.["ErrorResponse"]).toBeDefined();
  });

  it("should include proper HTTP methods and responses", () => {
    const serviceDescription = createTestServiceDescription();
    const generator = createOpenAPIGenerator(serviceDescription);
    
    const schema = generator.generateOpenAPISchema();
    
    // GET endpoint
    const getEndpoint = schema.paths?.["/test/{id}"]?.["get"];
    expect(getEndpoint?.summary).toBe("Retrieve test state");
    expect(getEndpoint?.responses?.[200]).toBeDefined();
    expect(getEndpoint?.responses?.[404]).toBeDefined();
    expect(getEndpoint?.responses?.[500]).toBeDefined();
    
    // POST command endpoint
    const postEndpoint = schema.paths?.["/test/{id}/update-value"]?.["post"];
    expect(postEndpoint?.summary).toBe("Update Value");
    expect(postEndpoint?.responses?.[200]).toBeDefined();
    expect(postEndpoint?.responses?.[400]).toBeDefined();
    expect(postEndpoint?.responses?.[404]).toBeDefined();
    expect(postEndpoint?.responses?.[500]).toBeDefined();
  });

  it("should include proper tags", () => {
    const serviceDescription = createTestServiceDescription();
    const generator = createOpenAPIGenerator(serviceDescription);
    
    const schema = generator.generateOpenAPISchema();
    
    expect(schema.tags).toBeDefined();
    expect(schema.tags).toHaveLength(1);
    expect(schema.tags?.[0]?.name).toBe("Test");
    expect(schema.tags?.[0]?.description).toBe("Test management operations");
  });

  it("should include server information", () => {
    const serviceDescription = createTestServiceDescription();
    const generator = createOpenAPIGenerator(serviceDescription);
    
    const schema = generator.generateOpenAPISchema();
    
    expect(schema.servers).toBeDefined();
    expect(schema.servers).toHaveLength(1);
    expect(schema.servers?.[0]?.url).toBe("/");
    expect(schema.servers?.[0]?.description).toBe("Local server");
  });
});