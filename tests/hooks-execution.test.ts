/**
 * @fileoverview 测试钩子函数的实际执行
 * 验证 beforeAll, afterAll, beforeEach, afterEach 是否按预期执行
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@dreamer/test";

describe("钩子函数执行测试", () => {
  beforeAll(() => {
    console.log("beforeAll 被执行了.....................0");
  });
  afterAll(() => {
    console.log("afterAll 被执行了.....................0");
  });
  describe("beforeAll 执行测试", () => {
    let beforeAllCalled = false;
    let beforeAllCallCount = 0;

    beforeAll(() => {
      console.log("beforeAll 被执行了.....................1");
      beforeAllCalled = true;
      beforeAllCallCount++;
    });

    it("beforeAll 应该在第一个测试前执行", () => {
      expect(beforeAllCalled).toBe(true);
      expect(beforeAllCallCount).toBe(1);
    });

    it("beforeAll 应该只执行一次", () => {
      // beforeAll 应该只执行一次，即使有多个测试
      expect(beforeAllCallCount).toBe(1);
    });

    it("beforeAll 应该在所有测试前执行", () => {
      expect(beforeAllCalled).toBe(true);
    });
  });

  describe("afterAll 执行测试", () => {
    let afterAllCalled = false;
    let afterAllCallCount = 0;

    afterAll(() => {
      afterAllCalled = true;
      afterAllCallCount++;
      console.log("afterAll 被执行了..................... 1");
    });

    it("测试1: 验证 afterAll 会在所有测试后执行", () => {
      expect(afterAllCalled).toBe(false); // 此时 afterAll 还未执行
    });

    it("测试2: 验证 afterAll 会在所有测试后执行", () => {
      expect(afterAllCalled).toBe(false); // 此时 afterAll 还未执行
    });
  });

  describe("beforeEach 执行测试", () => {
    let beforeEachCallCount = 0;
    let testExecutionOrder: string[] = [];

    beforeEach(() => {
      beforeEachCallCount++;
      testExecutionOrder.push(`beforeEach-${beforeEachCallCount}`);
    });

    it("测试1: beforeEach 应该在每个测试前执行", () => {
      testExecutionOrder.push("test1");
      expect(beforeEachCallCount).toBe(1);
      expect(testExecutionOrder).toEqual(["beforeEach-1", "test1"]);
    });

    it("测试2: beforeEach 应该在每个测试前执行", () => {
      testExecutionOrder.push("test2");
      expect(beforeEachCallCount).toBe(2);
      expect(testExecutionOrder).toEqual([
        "beforeEach-1",
        "test1",
        "beforeEach-2",
        "test2",
      ]);
    });

    it("测试3: beforeEach 应该在每个测试前执行", () => {
      testExecutionOrder.push("test3");
      expect(beforeEachCallCount).toBe(3);
    });
  });

  describe("afterEach 执行测试", () => {
    let afterEachCallCount = 0;
    let testExecutionOrder: string[] = [];

    afterEach(() => {
      afterEachCallCount++;
      testExecutionOrder.push(`afterEach-${afterEachCallCount}`);
    });

    it("测试1: afterEach 应该在每个测试后执行", () => {
      testExecutionOrder.push("test1");
      expect(afterEachCallCount).toBe(0); // 此时 afterEach 还未执行
    });

    it("测试2: afterEach 应该在每个测试后执行", () => {
      testExecutionOrder.push("test2");
      // afterEach 在测试完成后执行，所以此时应该已经执行了1次
      expect(afterEachCallCount).toBe(1);
      expect(testExecutionOrder).toEqual([
        "test1",
        "afterEach-1",
        "test2",
      ]);
    });
  });

  describe("钩子函数组合测试", () => {
    let executionOrder: string[] = [];
    let beforeAllCount = 0;
    let afterAllCount = 0;
    let beforeEachCount = 0;
    let afterEachCount = 0;

    beforeAll(() => {
      beforeAllCount++;
      executionOrder.push("beforeAll");
    });

    afterAll(() => {
      afterAllCount++;
      executionOrder.push("afterAll");
      console.log("组合测试 afterAll 被执行了..................... 2");
    });

    beforeEach(() => {
      beforeEachCount++;
      executionOrder.push(`beforeEach-${beforeEachCount}`);
    });

    afterEach(() => {
      afterEachCount++;
      executionOrder.push(`afterEach-${afterEachCount}`);
    });

    it("测试1: 验证钩子执行顺序", () => {
      executionOrder.push("test1");
      expect(beforeAllCount).toBe(1);
      expect(beforeEachCount).toBe(1);
      expect(afterEachCount).toBe(0); // 此时 afterEach 还未执行
    });

    it("测试2: 验证钩子执行顺序", () => {
      executionOrder.push("test2");
      expect(beforeAllCount).toBe(1); // beforeAll 只执行一次
      expect(beforeEachCount).toBe(2);
      expect(afterEachCount).toBe(1); // 第一个测试的 afterEach 已执行
    });

    it("测试3: 验证钩子执行顺序", () => {
      executionOrder.push("test3");
      expect(beforeAllCount).toBe(1);
      expect(beforeEachCount).toBe(3);
      expect(afterEachCount).toBe(2);
    });
  });

  describe("异步钩子函数测试", () => {
    let asyncBeforeAllCalled = false;
    let asyncBeforeEachCalled = false;
    let asyncAfterEachCalled = false;
    let asyncAfterAllCalled = false;

    beforeAll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncBeforeAllCalled = true;
    });

    afterAll(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncAfterAllCalled = true;
      console.log("异步 afterAll 被执行了..................... 3");
    });

    beforeEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      asyncBeforeEachCalled = true;
    });

    afterEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      asyncAfterEachCalled = true;
    });

    it("测试1: 异步 beforeAll 应该执行", () => {
      expect(asyncBeforeAllCalled).toBe(true);
      expect(asyncBeforeEachCalled).toBe(true);
    });

    it("测试2: 异步钩子应该正常工作", () => {
      expect(asyncBeforeAllCalled).toBe(true);
      expect(asyncBeforeEachCalled).toBe(true);
    });
  });

  describe("嵌套套件的钩子函数测试", () => {
    let parentBeforeAllCalled = false;
    let parentAfterAllCalled = false;
    let parentBeforeEachCalled = 0;
    let parentAfterEachCalled = 0;

    beforeAll(() => {
      parentBeforeAllCalled = true;
    });

    afterAll(() => {
      parentAfterAllCalled = true;
      console.log("父套件 afterAll 被执行了..................... 4");
    });

    beforeEach(() => {
      parentBeforeEachCalled++;
    });

    afterEach(() => {
      parentAfterEachCalled++;
    });

    it("父套件测试1", () => {
      expect(parentBeforeAllCalled).toBe(true);
      expect(parentBeforeEachCalled).toBe(1);
    });

    describe("子套件", () => {
      let childBeforeAllCalled = false;
      let childAfterAllCalled = false;
      let childBeforeEachCalled = 0;
      let childAfterEachCalled = 0;

      beforeAll(() => {
        childBeforeAllCalled = true;
      });

      afterAll(() => {
        childAfterAllCalled = true;
        console.log("子套件 afterAll 被执行了..................... 5");
      });

      beforeEach(() => {
        childBeforeEachCalled++;
      });

      afterEach(() => {
        childAfterEachCalled++;
      });

      it("子套件测试1", () => {
        expect(parentBeforeAllCalled).toBe(true);
        expect(childBeforeAllCalled).toBe(true);
        expect(parentBeforeEachCalled).toBe(2); // 父套件的 beforeEach 也会执行
        expect(childBeforeEachCalled).toBe(1);
      });

      it("子套件测试2", () => {
        expect(childBeforeAllCalled).toBe(true);
        expect(childBeforeEachCalled).toBe(2);
      });
    });

    it("父套件测试2", () => {
      expect(parentBeforeAllCalled).toBe(true);
    });
  });

  describe("钩子函数接收 TestContext 测试", () => {
    let beforeEachContext: any = null;
    let afterEachContext: any = null;

    beforeEach((t) => {
      beforeEachContext = t;
    });

    afterEach((t) => {
      afterEachContext = t;
    });

    it("beforeEach 应该接收 TestContext", () => {
      expect(beforeEachContext).toBeDefined();
      expect(beforeEachContext.name).toBeDefined();
    });

    it("afterEach 应该接收 TestContext", () => {
      expect(afterEachContext).toBeDefined();
      expect(afterEachContext.name).toBeDefined();
    });
  });
});
