import { bindings, defineConfig, exports, triggers } from "cf/config";
export default defineConfig({
  accountId: "05838fc24a89cefaf6081066cca13544",
  worker: {
    name: "lecorbusier-keff",
    entrypoint: "./worker/index.js",
    compatibilityDate: "2026-10-25",
    assets: {
      runWorkerFirst: true,
      htmlHandling: "none",
      notFoundHandling: "single-page-application",
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({
        name: "lecorbusier-db",
        id: "0458a2ad-9007-4a48-8bc6-f55f15e33928",
      }),
      LIVE: bindings.durableObject({
        worker: "lecorbusier-keff",
        exportName: "ParisLive",
      }),
      GENERATE: bindings.workflow({
        name: "lecorbusier-generate",
        worker: "lecorbusier-keff",
        exportName: "GenerateProposal",
      }),
      OPENAI_API_KEY: bindings.secret(),
      TEXT_MODEL: bindings.text("gpt-5.4-mini"),
      IMAGE_MODEL: bindings.text("gpt-image-2.5-sunburst"),
    },
    exports: {
      ParisLive: exports.durableObject({ storage: "sqlite" }),
      GenerateProposal: exports.workflow({ name: "lecorbusier-generate" }),
    },
    triggers: [
      triggers.fetch({ pattern: "keff.uk/corbs*", zone: "keff.uk" }),
      triggers.fetch({ pattern: "keff.uk/lecorbusier*", zone: "keff.uk" }),
    ],
    workersDev: true,
    observability: {
      enabled: true,
      redactQueryString: true,
      traces: { enabled: true, headSamplingRate: 0.1 },
    },
  },
});
