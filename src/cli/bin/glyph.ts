#!/usr/bin/env node
import {Command} from 'commander';
import { runBuild } from "../commands/build";

const app = new Command();
app.name('glyph').description('Glyph CLI');

runBuild(app);

app.parse();

