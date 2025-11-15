#!/usr/bin/env node
import {Command} from 'commander';
import { registerBuildCommand } from "../commands/build";
import { registerSetupCommand } from "../commands/setup";

const app = new Command();
app.name('glyph').description('Glyph CLI');

registerBuildCommand(app);
registerSetupCommand(app);

app.parse();

