import { Command } from "commander";
import { cli } from "./cli.ts";
import { getEnv } from "./env.ts";
import { handlers } from "./handlers.ts";

const program = new Command();
program.name("bln").description("Interact with BLN directly").version("0.0.0");

cli(program, handlers, getEnv());
program.parse(process.argv);
