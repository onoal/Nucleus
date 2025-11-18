import { proofModule, assetModule } from "../modules";
import type { ModuleConfig } from "../types";

describe("Module Helpers", () => {
  describe("proofModule", () => {
    it("should create a proof module config", () => {
      const module = proofModule();
      expect(module).toEqual({
        id: "proof",
        version: "1.0.0",
        config: {},
      });
    });

    it("should create a proof module with custom config", () => {
      const module = proofModule({
        strategies: ["ownership", "timestamp"],
      });
      expect(module.id).toBe("proof");
      expect(module.config).toEqual({
        strategies: ["ownership", "timestamp"],
      });
    });
  });

  describe("assetModule", () => {
    it("should create an asset module config", () => {
      const module = assetModule();
      expect(module).toEqual({
        id: "asset",
        version: "1.0.0",
        config: {},
      });
    });

    it("should create an asset module with custom config", () => {
      const module = assetModule({
        name: "tickets",
        indexBy: ["owner_oid"],
      });
      expect(module.id).toBe("asset");
      expect(module.config).toEqual({
        name: "tickets",
        indexBy: ["owner_oid"],
      });
    });
  });
});
