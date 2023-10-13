import { Config } from "jest";

export default {
  preset: "ts-jest",
  clearMocks: true,
  modulePaths: ["<rootDir>/src"],
  setupFiles: ["<rootDir>/setEnvVars.js"],
  globalSetup: "<rootDir>/dotenv/dotenv-test.js",
  collectCoverageFrom: ["<rootDir>/lambdas/**/*"],
  testMatch: ["<rootDir>/tests/**/*.test.ts"],
  coverageThreshold: {
    global: {
      statements: 87,
      branches: 80,
      functions: 80,
      lines: 87,
    },
  },
} satisfies Config;
