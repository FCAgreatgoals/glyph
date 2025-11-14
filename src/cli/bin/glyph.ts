#!/usr/bin/env node
import {Command} from 'commander';
import { runBuild } from "../commands/build";
import { runSetup } from "../commands/setup";

const app = new Command();
app.name('glyph').description('Glyph CLI');

runBuild(app);
runSetup(app);

app.parse();

