# 第六轮交互与表现修复

按用户明确要求执行，无新增待定规则。

1. main.ts：角色栏统一指针拖放；点击保留原行为，拖动直接部署/复制，右键和失去指针取消。
2. main.ts / scene.ts：濒死本体、复制体不显示移动路径/方向箭头。
3. spine.ts / scene.ts：复现真实资源错误，准备阶段预载正式角色；不使用手绘占位替代。
4. main.ts / style.css：疾行四向环绕，按鼠标相对角色的扇区选择；任意战场点击确认合法方向。
5. engine.ts / scene.ts：沿实际移动路段转向，纵向沿用最后左右朝向；停下恢复战斗朝向。
6. ui.ts / card-motion.ts：保留卡牌 DOM，抽入错峰、使用飞出、余牌平滑重排；支持减少动态效果。

验证：revision6 浏览器回归、相关引擎测试、生产构建、正式角色与方向界面截图。卡牌参考入口为 Mega Crit 官方 Slay the Spire press kit：https://www.megacrit.com/press-kits/slay-the-spire/ 。实现使用本项目现有资源，不复制其游戏素材。
