import {setup as base} from './en01-fixture';
import {beginWorld} from '../src/core/world-session';
import {hunterState} from '../src/core/hunter-state';
import {alState} from '../src/core/al-state';
import {trialState} from '../src/core/ability-trial';
export function setup(){const a=base();a.s.sessionMode='exploration';a.s.abilityTrial=true;a.s.trialProgression=true;beginWorld(a.s);a.s.context='explorationIdle';hunterState(a.h);alState(a.al);a.e.ready=100;return a;}
