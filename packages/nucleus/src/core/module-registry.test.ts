/**
 * Tests for module registry
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  registerModule,
  getModule,
  hasModule,
  clearModules,
  getRegisteredModules,
} from "./module-registry.js";
import { ModuleNotFoundError } from "../types/index.js";
import type { ModuleRuntime } from "../types/index.js";

describe("Module Registry", () => {
  // Mock module runtime
  const mockModule: ModuleRuntime = {
    async validateRecord() {
      return { ok: true };
    },
  };

  beforeEach(() => {
    // Clear registry before each test
    clearModules();
  });

  describe("registerModule()", () => {
    it("should register a module", () => {
      registerModule("test", mockModule);
      expect(hasModule("test")).toBe(true);
    });

    it("should reject empty module name", () => {
      expect(() => registerModule("", mockModule)).toThrow("non-empty string");
    });

    it("should reject duplicate registration", () => {
      registerModule("test", mockModule);
      expect(() => registerModule("test", mockModule)).toThrow("already registered");
    });

    it("should allow multiple different modules", () => {
      registerModule("oid", mockModule);
      registerModule("proof", mockModule);

      expect(hasModule("oid")).toBe(true);
      expect(hasModule("proof")).toBe(true);
    });
  });

  describe("getModule()", () => {
    it("should retrieve registered module", () => {
      registerModule("test", mockModule);
      const retrieved = getModule("test");
      expect(retrieved).toBe(mockModule);
    });

    it("should throw ModuleNotFoundError for unregistered module", () => {
      expect(() => getModule("nonexistent")).toThrow(ModuleNotFoundError);
      expect(() => getModule("nonexistent")).toThrow("not registered: nonexistent");
    });
  });

  describe("hasModule()", () => {
    it("should return false for unregistered module", () => {
      expect(hasModule("nonexistent")).toBe(false);
    });

    it("should return true for registered module", () => {
      registerModule("test", mockModule);
      expect(hasModule("test")).toBe(true);
    });
  });

  describe("getRegisteredModules()", () => {
    it("should return empty array initially", () => {
      expect(getRegisteredModules()).toEqual([]);
    });

    it("should return all registered module names", () => {
      registerModule("oid", mockModule);
      registerModule("proof", mockModule);

      const modules = getRegisteredModules();
      expect(modules).toContain("oid");
      expect(modules).toContain("proof");
      expect(modules).toHaveLength(2);
    });
  });

  describe("clearModules()", () => {
    it("should clear all registered modules", () => {
      registerModule("oid", mockModule);
      registerModule("proof", mockModule);

      expect(getRegisteredModules()).toHaveLength(2);

      clearModules();

      expect(getRegisteredModules()).toHaveLength(0);
      expect(hasModule("oid")).toBe(false);
      expect(hasModule("proof")).toBe(false);
    });
  });
});

