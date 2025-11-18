/**
 * Tests for Service Container
 *
 * ServiceContainer is exported from @onoal/ledger-core, so we can test it directly
 */

import { describe, it, expect } from "vitest";
import { ServiceContainer } from "@onoal/ledger-core";

describe("Service Container", () => {
  describe("Service registration", () => {
    it("should register service", () => {
      const container = new ServiceContainer();
      const service = { test: "value" };

      container.register("testService", service);

      const retrieved = container.resolve("testService");
      expect(retrieved).toBe(service);
    });

    it("should throw error for duplicate service registration", () => {
      const container = new ServiceContainer();
      const service1 = { test: "value1" };
      const service2 = { test: "value2" };

      container.register("testService", service1);

      expect(() => {
        container.register("testService", service2);
      }).toThrow(/Service already registered/);
    });

    it("should throw error for null service", () => {
      const container = new ServiceContainer();

      expect(() => {
        // @ts-expect-error - Testing invalid input
        container.register("testService", null);
      }).toThrow(/Cannot register null or undefined service/);
    });
  });

  describe("Service resolution", () => {
    it("should resolve registered service", () => {
      const container = new ServiceContainer();
      const service = { test: "value" };

      container.register("testService", service);
      const retrieved = container.resolve("testService");

      expect(retrieved).toBe(service);
    });

    it("should throw error for non-existent service", () => {
      const container = new ServiceContainer();

      expect(() => {
        container.resolve("nonExistentService");
      }).toThrow(/Service not found/);
    });

    it("should return service with correct type", () => {
      const container = new ServiceContainer();
      interface TestService {
        test(): string;
      }
      const service: TestService = {
        test: () => "test",
      };

      container.register("testService", service);
      const retrieved = container.resolve<TestService>("testService");

      expect(retrieved.test()).toBe("test");
    });
  });

  describe("Service existence check", () => {
    it("should return true for existing service", () => {
      const container = new ServiceContainer();
      container.register("testService", { test: "value" });

      expect(container.has("testService")).toBe(true);
    });

    it("should return false for non-existent service", () => {
      const container = new ServiceContainer();

      expect(container.has("nonExistentService")).toBe(false);
    });
  });

  describe("Service metadata", () => {
    it("should store service metadata", () => {
      const container = new ServiceContainer();
      container.register("testService", { test: "value" }, "module-id");

      const metadata = container.getMetadata("testService");
      expect(metadata).toBeDefined();
      expect(metadata?.moduleId).toBe("module-id");
      expect(metadata?.registeredAt).toBeGreaterThan(0);
    });
  });

  describe("Service names", () => {
    it("should return all registered service names", () => {
      const container = new ServiceContainer();
      container.register("service1", {});
      container.register("service2", {});

      const names = container.getServiceNames();
      expect(names).toContain("service1");
      expect(names).toContain("service2");
      expect(names.length).toBe(2);
    });
  });

  describe("Clear services", () => {
    it("should clear all services", () => {
      const container = new ServiceContainer();
      container.register("service1", {});
      container.register("service2", {});

      container.clear();

      expect(container.has("service1")).toBe(false);
      expect(container.has("service2")).toBe(false);
      expect(container.getServiceNames().length).toBe(0);
    });
  });
});
