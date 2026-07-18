import assert from "node:assert/strict";
import test from "node:test";
import { SkillType, ULTIMATE_SKILL_NAME, createSkillCatalog, getSkillName, updateSkillSettings } from "./skill-catalog.js";

test("각 속성은 이름이 정해진 A·B·C 3개 스킬을 가진다", () => {
  const catalog = createSkillCatalog();

  assert.equal(catalog["normal-1"].name, "마나볼");
  assert.equal(catalog["normal-2"].name, "트리플 볼");
  assert.equal(catalog["normal-3"].name, "하이퍼 볼");
  assert.equal(catalog["fire-1"].name, "파이어볼");
  assert.equal(catalog["fire-2"].name, "파이어 웨이브");
  assert.equal(catalog["water-3"].name, "파도의 부름");
  assert.equal(catalog["grass-3"].name, "가시덩쿨");
  assert.equal(catalog["rock-3"].name, "대지진");
  assert.equal(catalog["electric-3"].name, "라이트닝 썬더");
  assert.equal(catalog["ice-3"].name, "스노우 그레이브");
  assert.equal(catalog["light-3"].name, "스타 슬레이브");
  assert.equal(catalog["dark-3"].name, "시공간 붕괴");
  assert.equal(getSkillName("light", 2), "십자 광선");
  assert.equal(ULTIMATE_SKILL_NAME, "신의 가호");
  assert.equal(catalog["fire-1"].type, SkillType.PROJECTILE);
  assert.equal(catalog["fire-2"].type, SkillType.AREA);
  assert.equal(catalog["fire-3"].type, SkillType.TARGET);
  assert.equal(catalog["fire-1"].settings.attackPower, catalog["water-1"].settings.attackPower);
  assert.equal(catalog["fire-1"].settings.castDelayMs, catalog["water-1"].settings.castDelayMs);
});

test("스킬별 수치는 언제든 원본을 보존한 채 수정할 수 있다", () => {
  const catalog = createSkillCatalog();
  const updated = updateSkillSettings(catalog, "electric-1", {
    projectileSpeed: 1200,
    projectileSize: 36,
    attackPower: 135,
    castDelayMs: 300,
  });

  assert.equal(catalog["electric-1"].settings.projectileSpeed, 800);
  assert.deepEqual(updated["electric-1"].settings, {
    attackPower: 135,
    castDelayMs: 300,
    projectileSpeed: 1200,
    projectileSize: 36,
  });
});

test("B형 스킬은 반지름·공격력·지속 시간을 수정할 수 있다", () => {
  const updated = updateSkillSettings(createSkillCatalog(), "rock-2", {
    radius: 180,
    attackPower: 160,
    durationMs: 1600,
  });

  assert.equal(updated["rock-2"].settings.radius, 180);
  assert.equal(updated["rock-2"].settings.attackPower, 160);
  assert.equal(updated["rock-2"].settings.durationMs, 1600);
});
