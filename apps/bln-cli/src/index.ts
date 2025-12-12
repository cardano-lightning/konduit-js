import { Command } from "commander";
import { cli } from "./cli";
import { getEnv } from "./env";
import { handlers } from "./handlers";

const program = new Command();
program.name("bln").description("Interact with BLN directly").version("0.0.0");

cli(program, handlers, getEnv());
program.parse(process.argv);
