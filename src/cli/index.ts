#!/usr/bin/env bun
/**
 * synapse CLI — entry point
 * Usage: bun run synapse <command> [options]
 */

const VERSION = "0.1.0";

const COMMANDS = `
Commands:
  products                    List registered products
  add <path>                  Register a repo with Synapse
  start <product>             Start the pipeline daemon for a product
  stop <product>              Stop the pipeline daemon
  resume <product>            Resume a stopped/escalated pipeline
  inbox                       Show gates waiting for human action
  approve <run-id>            Approve a gate (moves pipeline forward)
  reject <run-id> --note "…"  Reject a gate (writes feedback file)
  status [<product>]          Show pipeline status
  artifacts <product>         List pipeline artifacts
`;

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`synapse v${VERSION} — AI development lifecycle orchestrator`);
  console.log(COMMANDS);
  process.exit(0);
}

if (args[0] === "--version" || args[0] === "-v") {
  console.log(VERSION);
  process.exit(0);
}

// TODO (Layer 1): implement command dispatch
console.error(`synapse: command '${args[0]}' not yet implemented.`);
console.error("Run 'bun run synapse --help' for usage.");
process.exit(1);
