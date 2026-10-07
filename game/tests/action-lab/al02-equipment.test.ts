import {describe,it,expect} from 'vitest';
import {AttackEvents,AxeEquipment,type AttackEvent} from '../../src/action-lab/runtime/attack-events';

const event=(id:number,skill='a1',left=true):AttackEvent=>({id,generation:1,casterId:'blue',actionId:id,rootId:id,parentId:null,slotSkillId:'a1',executedSkillId:skill,isLeftMouse:left,tags:[],suppressBuff:false,facing:0});
describe('AL02 source attack-event equipment consumer',()=>{
  it('commits CD before child request, rejecting synchronous reentry',()=>{
    const bus=new AttackEvents();const requests:AttackEvent[]=[];
    const axe=new AxeEquipment(bus,1,'blue',e=>{requests.push(e);bus.publish(event(2));});
    bus.publish(event(1));expect(requests).toHaveLength(1);expect(axe.cooldown).toBe(8);
    bus.publish(event(1));expect(requests).toHaveLength(1);
  });
  it('uses actual tags, accepts replaced ice, and refuses suppression / other casters',()=>{
    const bus=new AttackEvents();const requests:AttackEvent[]=[];
    const axe=new AxeEquipment(bus,1,'blue',e=>requests.push(e));
    bus.publish({...event(1),suppressBuff:true});bus.publish({...event(2),casterId:'other'});
    bus.publish(event(3,'auxiliary',false));expect(requests).toHaveLength(0);
    bus.publish({...event(4,'小蓝a4.8戳地',false),tags:['左键']});expect(requests).toHaveLength(1);
    axe.advance(8);bus.publish(event(4));expect(requests).toHaveLength(1);
    bus.publish(event(5));expect(requests).toHaveLength(2);
  });
  it('detach prevents new requests and leaves already requested effects alone',()=>{
    const bus=new AttackEvents();let count=0;
    const axe=new AxeEquipment(bus,1,'blue',()=>count++);
    expect(bus.subscriberCount).toBe(1);bus.publish(event(1));axe.detach();axe.detach();
    expect(bus.subscriberCount).toBe(0);axe.advance(8);bus.publish(event(2));expect(count).toBe(1);
  });
  it('CD is independent per handle, bounded by simulation delta and generation',()=>{
    const bus=new AttackEvents();let count=0;const axe=new AxeEquipment(bus,1,'blue',()=>count++);
    bus.publish({...event(1),generation:2});expect(count).toBe(0);
    bus.publish(event(2));axe.advance(2);expect(axe.cooldown).toBe(6);
    expect(()=>axe.advance(-1)).toThrow();axe.advance(20);expect(axe.cooldown).toBe(0);
  });
});
it('two caster handles share definitions but never mutable CD or consumption',()=>{
 const bus=new AttackEvents();let blue=0,other=0;
 const a=new AxeEquipment(bus,1,'blue',()=>blue++);const b=new AxeEquipment(bus,1,'other',()=>other++);
 bus.publish(event(1));expect(a.cooldown).toBe(8);expect(b.cooldown).toBe(0);
 bus.publish({...event(1),casterId:'other'});expect(blue).toBe(1);expect(other).toBe(1);
 a.advance(8);expect(b.cooldown).toBe(8);a.detach();b.detach();expect(bus.subscriberCount).toBe(0);
});
