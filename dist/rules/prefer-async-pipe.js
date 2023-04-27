"use strict";
const eslint_etc_1 = require("eslint-etc");
const utils_1 = require("../utils");
const rule = (0, utils_1.ruleCreator)({
  defaultOptions: [],
  meta: {
    docs: {
      description: "Forbids the calling of `subscribe` within Angular components.",
      recommended: false,
    },
    fixable: undefined,
    hasSuggestions: false,
    messages: {
      forbidden: "Calling `subscribe` in a component is forbidden; use an `async` pipe instead.",
    },
    schema: [],
    type: "problem",
  },
  name: "prefer-async-pipe",
  create: (context) => {
    const { couldBeObservable } = (0, eslint_etc_1.getTypeServices)(context);
    const componentMap = new WeakMap();
    return {
      [`CallExpression > MemberExpression[property.name="subscribe"]`]: (memberExpression) => {
        let parent = (0, eslint_etc_1.getParent)(memberExpression);
        while (parent) {
          if (componentMap.has(parent) &&
            couldBeObservable(memberExpression.object)) {
            context.report({
              messageId: "forbidden",
              node: memberExpression.property,
            });
            return;
          }
          parent = (0, eslint_etc_1.getParent)(parent);
        }
      },
      [`ClassDeclaration > Decorator[expression.callee.name="Component"]`]: (node) => {
        const classDeclaration = (0, eslint_etc_1.getParent)(node);
        componentMap.set(classDeclaration);
      },
    };
  },
});
module.exports = rule;
