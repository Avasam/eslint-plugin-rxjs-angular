"use strict";
const common_tags_1 = require("common-tags");
const eslint_etc_1 = require("eslint-etc");
const utils_1 = require("../utils");
const messages = {
  noDestroy: "`ngOnDestroy` is not implemented.",
  noTakeUntil:
    "Forbids calling `subscribe` without an accompanying `takeUntil`.",
  notCalled: "`{{name}}.{{method}}()` not called.",
  notDeclared: "Subject `{{name}}` not a class property.",
};
const ngOnDestroyMethodSelector =
  "MethodDefinition[key.name='ngOnDestroy'][kind='method']";
const defaultOptions = [];
const rule = (0, utils_1.ruleCreator)({
  defaultOptions,
  meta: {
    docs: {
      description:
        "Forbids `subscribe` calls without an accompanying `takeUntil` within Angular components (and, optionally, within services, directives, and pipes).",
      recommended: false,
    },
    fixable: undefined,
    hasSuggestions: false,
    messages,
    schema: [
      {
        properties: {
          alias: { type: "array", items: { type: "string" } },
          checkComplete: { type: "boolean" },
          checkDecorators: { type: "array", items: { type: "string" } },
          checkDestroy: { type: "boolean" },
          superClass: { type: "array", items: { type: "string" } },
        },
        type: "object",
        description: (0, common_tags_1.stripIndent)`
        An optional object with optional \`alias\`, \`checkComplete\`, \`checkDecorators\` and \`checkDestroy\` properties.
        The \`alias\` property is an array containing the names of operators that aliases for \`takeUntil\`.
        The \`checkComplete\` property is a boolean that determines whether or not \`complete\` must be called after \`next\`.
        The \`checkDecorators\` property is an array containing the names of the decorators that determine whether or not a class is checked.
        The \`checkDestroy\` property is a boolean that determines whether or not a \`Subject\`-based \`ngOnDestroy\` must be implemented.
        The \`superClass\` property is an array containing the names of classes to extend from that already implements a \`Subject\`-based \`ngOnDestroy\`.
      `,
      },
    ],
    type: "problem",
  },
  name: "prefer-takeuntil",
  create: (context, unused) => {
    const { couldBeObservable } = (0, eslint_etc_1.getTypeServices)(context);
    const [config = {}] = context.options;
    const {
      alias = [],
      checkComplete = false,
      checkDecorators = ["Component"],
      checkDestroy = alias.length === 0,
      superClass = [],
    } = config;
    const entries = [];
    function checkEntry(entry) {
      const { subscribeCallExpressions } = entry;
      subscribeCallExpressions.forEach((callExpression) => {
        const { callee } = callExpression;
        if (!(0, eslint_etc_1.isMemberExpression)(callee)) {
          return;
        }
        const { object } = callee;
        if (!couldBeObservable(object)) {
          return;
        }
        checkSubscribe(callExpression, entry);
      });
      if (checkDestroy) {
        checkNgOnDestroy(entry);
      }
    }
    function checkNgOnDestroy(entry) {
      var _a;
      const {
        classDeclaration,
        completeCallExpressions,
        nextCallExpressions,
        ngOnDestroyDefinition,
        extendsSuperClassDeclaration,
        superNgOnDestroyCallExpression,
        subscribeCallExpressionsToNames,
      } = entry;
      if (subscribeCallExpressionsToNames.size === 0) {
        return;
      }
      if (!ngOnDestroyDefinition) {
        if (extendsSuperClassDeclaration) {
          return;
        }
        context.report({
          messageId: "noDestroy",
          node:
            (_a = classDeclaration.id) !== null && _a !== void 0
              ? _a
              : classDeclaration,
        });
        return;
      }
      const namesToChecks = new Map();
      const names = new Set();
      subscribeCallExpressionsToNames.forEach((value) =>
        value.forEach((name) => names.add(name))
      );
      names.forEach((name) => {
        var _a;
        const check = {
          descriptors: [],
          report: false,
        };
        namesToChecks.set(name, check);
        if (extendsSuperClassDeclaration) {
          if (!superNgOnDestroyCallExpression) {
            check.descriptors.push({
              data: { method: "ngOnDestroy", name: "super" },
              messageId: "notCalled",
              node: ngOnDestroyDefinition.key,
            });
          }
        } else {
          if (!checkSubjectProperty(name, entry)) {
            check.descriptors.push({
              data: { name },
              messageId: "notDeclared",
              node:
                (_a = classDeclaration.id) !== null && _a !== void 0
                  ? _a
                  : classDeclaration,
            });
          }
          if (!checkSubjectCall(name, nextCallExpressions)) {
            check.descriptors.push({
              data: { method: "next", name },
              messageId: "notCalled",
              node: ngOnDestroyDefinition.key,
            });
          }
          if (
            checkComplete &&
            !checkSubjectCall(name, completeCallExpressions)
          ) {
            check.descriptors.push({
              data: { method: "complete", name },
              messageId: "notCalled",
              node: ngOnDestroyDefinition.key,
            });
          }
        }
      });
      subscribeCallExpressionsToNames.forEach((names) => {
        const report = [...names].every(
          (name) => namesToChecks.get(name).descriptors.length > 0
        );
        if (report) {
          names.forEach((name) => (namesToChecks.get(name).report = true));
        }
      });
      namesToChecks.forEach((check) => {
        if (check.report) {
          check.descriptors.forEach((descriptor) => context.report(descriptor));
        }
      });
    }
    function checkOperator(callExpression) {
      const { callee } = callExpression;
      if (!(0, eslint_etc_1.isIdentifier)(callee)) {
        return { found: false };
      }
      if (callee.name === "takeUntil" || alias.includes(callee.name)) {
        const [arg] = callExpression.arguments;
        if (arg) {
          if (
            (0, eslint_etc_1.isMemberExpression)(arg) &&
            (0, eslint_etc_1.isThisExpression)(arg.object) &&
            (0, eslint_etc_1.isIdentifier)(arg.property)
          ) {
            return { found: true, name: arg.property.name };
          } else if (arg && (0, eslint_etc_1.isIdentifier)(arg)) {
            return { found: true, name: arg.name };
          }
        }
        if (!checkDestroy) {
          return { found: true };
        }
      }
      return { found: false };
    }
    function checkSubjectCall(name, callExpressions) {
      const callExpression = callExpressions.find(
        ({ callee }) =>
          ((0, eslint_etc_1.isMemberExpression)(callee) &&
            (0, eslint_etc_1.isIdentifier)(callee.object) &&
            callee.object.name === name) ||
          ((0, eslint_etc_1.isMemberExpression)(callee) &&
            (0, eslint_etc_1.isMemberExpression)(callee.object) &&
            (0, eslint_etc_1.isThisExpression)(callee.object.object) &&
            (0, eslint_etc_1.isIdentifier)(callee.object.property) &&
            callee.object.property.name === name)
      );
      return Boolean(callExpression);
    }
    function checkSubjectProperty(name, entry) {
      const { propertyDefinitions } = entry;
      const propertyDefinition = propertyDefinitions.find(
        (propertyDefinition) => propertyDefinition.key.name === name
      );
      return Boolean(propertyDefinition);
    }
    function checkSubscribe(callExpression, entry) {
      const { subscribeCallExpressionsToNames } = entry;
      const names = subscribeCallExpressionsToNames.get(callExpression);
      let takeUntilFound = false;
      const { callee } = callExpression;
      if (!(0, eslint_etc_1.isMemberExpression)(callee)) {
        return;
      }
      const { object, property } = callee;
      if (
        (0, eslint_etc_1.isCallExpression)(object) &&
        (0, eslint_etc_1.isMemberExpression)(object.callee) &&
        (0, eslint_etc_1.isIdentifier)(object.callee.property) &&
        object.callee.property.name === "pipe"
      ) {
        const operators = object.arguments;
        operators.forEach((operator) => {
          if ((0, eslint_etc_1.isCallExpression)(operator)) {
            const { found, name } = checkOperator(operator);
            takeUntilFound = takeUntilFound || found;
            if (name) {
              names.add(name);
            }
          }
        });
      }
      if (!takeUntilFound) {
        context.report({
          messageId: "noTakeUntil",
          node: property,
        });
      }
    }
    function getEntry() {
      const { length, [length - 1]: entry } = entries;
      return entry;
    }
    function hasDecorator(node) {
      const { decorators } = node;
      return (
        decorators &&
        decorators.some((decorator) => {
          const { expression } = decorator;
          if (!(0, eslint_etc_1.isCallExpression)(expression)) {
            return false;
          }
          if (!(0, eslint_etc_1.isIdentifier)(expression.callee)) {
            return false;
          }
          const { name } = expression.callee;
          return checkDecorators.some((check) => name === check);
        })
      );
    }
    const extendsSuperClassDeclaration =
      superClass.length === 0
        ? {}
        : {
            [`ClassDeclaration:matches(${superClass
              .map((className) => `[superClass.name="${className}"]`)
              .join()})`]: (node) => {
              const entry = getEntry();
              if (entry && entry.hasDecorator) {
                entry.extendsSuperClassDeclaration = node;
              }
            },
          };
    return {
      "CallExpression[callee.property.name='subscribe']": (node) => {
        const entry = getEntry();
        if (entry && entry.hasDecorator) {
          entry.subscribeCallExpressions.push(node);
          entry.subscribeCallExpressionsToNames.set(node, new Set());
        }
      },
      ClassDeclaration: (node) => {
        entries.push({
          classDeclaration: node,
          propertyDefinitions: [],
          completeCallExpressions: [],
          nextCallExpressions: [],
          hasDecorator: hasDecorator(node),
          subscribeCallExpressions: [],
          subscribeCallExpressionsToNames: new Map(),
        });
      },
      "ClassDeclaration:exit": (node) => {
        const entry = entries.pop();
        if (entry && entry.hasDecorator) {
          checkEntry(entry);
        }
      },
      PropertyDefinition: (node) => {
        const entry = getEntry();
        if (entry && entry.hasDecorator) {
          entry.propertyDefinitions.push(node);
        }
      },
      [ngOnDestroyMethodSelector]: (node) => {
        const entry = getEntry();
        if (entry && entry.hasDecorator) {
          entry.ngOnDestroyDefinition = node;
        }
      },
      ...extendsSuperClassDeclaration,
      [`${ngOnDestroyMethodSelector} CallExpression[callee.object.type='Super'][callee.property.name='ngOnDestroy']`]:
        (node) => {
          const entry = getEntry();
          if (entry && entry.hasDecorator) {
            entry.superNgOnDestroyCallExpression = node;
          }
        },
      [`${ngOnDestroyMethodSelector} CallExpression[callee.property.name='next']`]:
        (node) => {
          const entry = getEntry();
          if (entry && entry.hasDecorator) {
            entry.nextCallExpressions.push(node);
          }
        },
      [`${ngOnDestroyMethodSelector} CallExpression[callee.property.name='complete']`]:
        (node) => {
          const entry = getEntry();
          if (entry && entry.hasDecorator) {
            entry.completeCallExpressions.push(node);
          }
        },
    };
  },
});
module.exports = rule;
