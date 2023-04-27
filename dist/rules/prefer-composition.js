"use strict";
const common_tags_1 = require("common-tags");
const eslint_etc_1 = require("eslint-etc");
const utils_1 = require("../utils");
const defaultOptions = [];
const rule = (0, utils_1.ruleCreator)({
  defaultOptions,
  meta: {
    docs: {
      description: "Forbids `subscribe` calls that are not composed within Angular components (and, optionally, within services, directives, and pipes).",
      recommended: false,
    },
    fixable: undefined,
    hasSuggestions: false,
    messages: {
      notComposed: "Subscription not composed.",
      notDeclared: "Composed subscription `{{name}}` not a class property.",
      notImplemented: "`ngOnDestroy` not implemented.",
      notUnsubscribed: "Composed subscription not unsubscribed.",
    },
    schema: [
      {
        properties: {
          checkDecorators: { type: "array", items: { type: "string" } },
          superClass: { type: "array", items: { type: "string" } },
        },
        type: "object",
        description: (0, common_tags_1.stripIndent)`
        An optional object with an optional \`checkDecorators\` property.
        The \`checkDecorators\` property is an array containing the names of the decorators that determine whether or not a class is checked.
        The \`superClass\` property is an array containing the names of classes to extend from that already implements a \`Subject\`-based \`ngOnDestroy\`.
      `,
      },
    ],
    type: "problem",
  },
  name: "prefer-composition",
  create: (context, unused) => {
    const { couldBeObservable, couldBeSubscription } = (0, eslint_etc_1.getTypeServices)(context);
    const [{ checkDecorators = ["Component"], superClass = [] } = {}] = context.options;
    const entries = [];
    function checkEntry(record) {
      var _a;
      const { classDeclaration, propertyDefinitions, ngOnDestroyDefinition, extendsSuperClassDeclaration, subscribeCallExpressions, subscriptions, unsubscribeCallExpressions, } = record;
      if (subscribeCallExpressions.length === 0) {
        return;
      }
      subscribeCallExpressions.forEach((callExpression) => {
        const { callee } = callExpression;
        if ((0, eslint_etc_1.isMemberExpression)(callee)) {
          if (extendsSuperClassDeclaration) {
            return;
          }
          const { object, property } = callee;
          if (!couldBeObservable(object)) {
            return;
          }
          if (isComposed(callExpression, record)) {
            return;
          }
          context.report({
            messageId: "notComposed",
            node: property,
          });
        }
      });
      if (!ngOnDestroyDefinition) {
        if (extendsSuperClassDeclaration) {
          return;
        }
        context.report({
          messageId: "notImplemented",
          node: (_a = classDeclaration.id) !== null && _a !== void 0 ? _a : classDeclaration,
        });
        return;
      }
      subscriptions.forEach((subscription) => {
        var _a;
        const propertyDefinition = propertyDefinitions.find((propertyDefinition) => propertyDefinition.key.name === subscription);
        if (!propertyDefinition) {
          context.report({
            data: { name: subscription },
            messageId: "notDeclared",
            node: (_a = classDeclaration.id) !== null && _a !== void 0 ? _a : classDeclaration,
          });
          return;
        }
        const callExpression = unsubscribeCallExpressions.find((callExpression) => {
          const name = getMethodCalleeName(callExpression);
          return name === subscription;
        });
        if (!callExpression) {
          context.report({
            data: { name: subscription },
            messageId: "notUnsubscribed",
            node: propertyDefinition.key,
          });
          return;
        }
      });
    }
    function getEntry() {
      const { length, [length - 1]: entry } = entries;
      return entry;
    }
    function getMethodCalleeName(callExpression) {
      const { callee } = callExpression;
      if ((0, eslint_etc_1.isMemberExpression)(callee)) {
        const { object } = callee;
        if ((0, eslint_etc_1.isMemberExpression)(object) && (0, eslint_etc_1.isIdentifier)(object.property)) {
          return object.property.name;
        }
        if ((0, eslint_etc_1.isIdentifier)(object)) {
          return object.name;
        }
      }
      return undefined;
    }
    function getMethodCalleeObject(callExpression) {
      const { callee } = callExpression;
      if ((0, eslint_etc_1.isMemberExpression)(callee)) {
        return callee.object;
      }
      return undefined;
    }
    function hasDecorator(node) {
      const { decorators } = node;
      return (decorators &&
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
        }));
    }
    function isComposed(callExpression, entry) {
      const { addCallExpressions, subscriptions } = entry;
      const parent = (0, eslint_etc_1.getParent)(callExpression);
      if (!parent) {
        return false;
      }
      if ((0, eslint_etc_1.isCallExpression)(parent)) {
        const addCallExpression = addCallExpressions.find((callExpression) => callExpression === parent);
        if (!addCallExpression) {
          return false;
        }
        const object = getMethodCalleeObject(addCallExpression);
        if (!object || !couldBeSubscription(object)) {
          return false;
        }
        const name = getMethodCalleeName(addCallExpression);
        if (!name) {
          return false;
        }
        subscriptions.add(name);
        return true;
      }
      if ((0, eslint_etc_1.isVariableDeclarator)(parent) && (0, eslint_etc_1.isIdentifier)(parent.id)) {
        return isVariableComposed(parent.id, entry);
      }
      if ((0, eslint_etc_1.isAssignmentExpression)(parent) &&
        (0, eslint_etc_1.isIdentifier)(parent.left) &&
        parent.operator === "=") {
        return isVariableComposed(parent.left, entry);
      }
      return false;
    }
    function isVariableComposed(identifier, entry) {
      const { name } = identifier;
      const { addCallExpressions, subscriptions } = entry;
      const addCallExpression = addCallExpressions.find((callExpression) => getMethodCalleeName(callExpression) === name);
      if (!addCallExpression) {
        return false;
      }
      const object = getMethodCalleeObject(addCallExpression);
      if (!object || !couldBeSubscription(object)) {
        return false;
      }
      subscriptions.add(name);
      return true;
    }
    const extendsSuperClassDeclaration = superClass.length === 0
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
      "CallExpression[callee.property.name='add']": (node) => {
        const entry = getEntry();
        if (entry && entry.hasDecorator) {
          entry.addCallExpressions.push(node);
        }
      },
      "CallExpression[callee.property.name='subscribe']": (node) => {
        const entry = getEntry();
        if (entry && entry.hasDecorator) {
          entry.subscribeCallExpressions.push(node);
        }
      },
      ClassDeclaration: (node) => {
        entries.push({
          addCallExpressions: [],
          classDeclaration: node,
          propertyDefinitions: [],
          hasDecorator: hasDecorator(node),
          subscribeCallExpressions: [],
          subscriptions: new Set(),
          unsubscribeCallExpressions: [],
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
      ...extendsSuperClassDeclaration,
      "MethodDefinition[key.name='ngOnDestroy'][kind='method']": (node) => {
        const entry = getEntry();
        if (entry && entry.hasDecorator) {
          entry.ngOnDestroyDefinition = node;
        }
      },
      "MethodDefinition[key.name='ngOnDestroy'][kind='method'] CallExpression[callee.property.name='unsubscribe']": (node) => {
        const entry = getEntry();
        if (entry && entry.hasDecorator) {
          entry.unsubscribeCallExpressions.push(node);
        }
      },
    };
  },
});
module.exports = rule;
