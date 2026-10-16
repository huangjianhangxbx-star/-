export type Value=boolean|string|number;
export type DialogueCondition=
 |{kind:'flag';key:string;equals:Value}|{kind:'storyNode';id:string}
 |{kind:'questState';questId:string;state:string}
 |{kind:'characterState';actorId:string;key:string;op:'eq'|'gte'|'lte';value:Value}
 |{kind:'worldPlace';placeId:number}|{kind:'inventory';itemId:string;min:number}
 |{kind:'custom';predicateId:string;args?:unknown};
export type DialogueEffect={kind:'setFlag';key:string;value:Value}|{kind:'notice';text:string}|{kind:'openShop';merchantId:string}|{kind:'acceptQuest';questId:string}|{kind:'startAvg';sceneId:string}|{kind:'teleport';destinationId:string};
export type DialogueOption={id:string;text:string;next:string};
export type DialogueNode={kind:'line';id:string;speakerId:string;text:string;next?:string}|{kind:'choice';id:string;prompt?:string;options:DialogueOption[]}|{kind:'effect';id:string;effect:DialogueEffect;next?:string}|{kind:'end';id:string};
export type DialogueDefinition={id:string;actorId:string;trigger:'interaction'|'event'|'quest'|'system';priority:number;repeat:'always'|'once'|'oncePerWorld'|'cooldown';cooldownSeconds?:number;conditions:DialogueCondition[];entryNodeId:string;nodes:Record<string,DialogueNode>};
export type History=Record<string,{count:number;worlds:string[];last:number}>;
export type DialogueContext={actorId:string;initiator:string;trigger:DialogueDefinition['trigger'];world:string;place:number;identity:string;valid:boolean;time:number;flags:Record<string,Value>;storyNodes:string[];quests:Record<string,string>;characters:Record<string,Record<string,Value>>;inventory:Record<string,number>;history:History};
export type Predicates=Record<string,(context:Readonly<DialogueContext>,args:unknown)=>boolean>;
export type DialogueSessionSnapshot={sessionId:string;definitionId:string;actorId:string;initiator:string;world:string;place:number;identity:string;nodeId:string;revision:number;shownNodes:string[];chosenOptions:string[];status:'active'|'ended'|'cancelled';kind:'line'|'choice'|'end';speakerId:string;text:string;options:DialogueOption[];hasNext:boolean};
export type DialogueStartRequest={definitions:DialogueDefinition[];context:DialogueContext;predicates?:Predicates};
export type DialogueAdvanceRequest={sessionId:string;revision:number};
export type DialogueChoiceRequest=DialogueAdvanceRequest&{optionId:string};
export type DialogueCancelRequest=DialogueAdvanceRequest;
export interface DialogueScriptRuntime{start(r:DialogueStartRequest):DialogueSessionSnapshot;advance(r:DialogueAdvanceRequest):DialogueSessionSnapshot;choose(r:DialogueChoiceRequest):DialogueSessionSnapshot;cancel(r:DialogueCancelRequest):DialogueSessionSnapshot;}
