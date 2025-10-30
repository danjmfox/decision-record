#!/usr/bin/env node
import { Command } from "commander";
import { createDecision, listAll, acceptDecision } from "../core/service.js";

const program = new Command();
program.name("drctl").description("Decision Record CLI").version("0.1.0");

program
  .command("new <domain> <slug>")
  .option("--confidence <n>", "initial confidence", parseFloat)
  .action((domain, slug, opts) => {
    const rec = createDecision(domain, slug, opts.confidence);
    console.log(`✅ Created ${rec.id} (${rec.status})`);
  });

program
  .command("list")
  .option("--status <status>", "filter by status")
  .action((opts) => {
    const list = listAll(opts.status);
    list.forEach((r) =>
      console.log(`${r.id.padEnd(45)} ${r.status.padEnd(10)} ${r.domain}`)
    );
  });

program.command("accept <id>").action((id) => {
  const rec = acceptDecision(id);
  console.log(`✅ ${rec.id} marked as accepted`);
});

program.parse();
