import path from "node:path";

const root = path.resolve(import.meta.dirname, "../src");
const rank = {
  shared: 0,
  entities: 1,
  features: 2,
  widgets: 3,
  pages: 4,
  app: 5,
};

function describe(filename) {
  const relative = path.relative(root, filename).split(path.sep).join("/");
  const [layer, slice] = relative.split("/");
  if (!(layer in rank)) return null;
  return {
    relative,
    layer,
    slice,
    core: /^(entities|features)\/[^/]+\/model(?:\/|$)/.test(relative),
  };
}

export const boundaries = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      layer: "{{from}} must not depend on higher layer {{to}}.",
      slice:
        "Slices on the {{layer}} layer must be composed from a higher layer, not imported into one another.",
      core: "Domain/application models may only import pure model modules; React, HTTP, DTOs and adapters stay outside.",
      adapter:
        "Choose the concrete registration repository in app/, then inject its interface.",
      support: "Production modules must not depend on tests or mocks.",
    },
  },
  create(context) {
    const from = describe(context.filename);
    if (!from) return {};
    function check(node, value) {
      if (typeof value !== "string") return;
      if (!value.startsWith(".")) {
        if (from.core) context.report({ node, messageId: "core" });
        return;
      }
      const target = path.resolve(path.dirname(context.filename), value);
      const to = describe(target);
      if (from.core) {
        const ownModel =
          to?.core && from.layer === to.layer && from.slice === to.slice;
        const entityModel = to?.core && to.layer === "entities";
        if (!ownModel && !entityModel) {
          context.report({ node, messageId: "core" });
          return;
        }
      }
      if (!to) {
        if (target.startsWith(root) && /\/(mocks|tests)\//.test(target))
          context.report({ node, messageId: "support" });
        return;
      }
      if (rank[to.layer] > rank[from.layer]) {
        context.report({
          node,
          messageId: "layer",
          data: { from: from.layer, to: to.layer },
        });
      } else if (
        from.layer === to.layer &&
        !["app", "shared"].includes(from.layer) &&
        from.slice !== to.slice
      ) {
        context.report({
          node,
          messageId: "slice",
          data: { layer: from.layer },
        });
      }
      if (
        to.relative.startsWith(
          "entities/registration/api/http-registration-repository",
        ) &&
        from.layer !== "app" &&
        !(from.layer === "entities" && from.slice === "registration")
      ) {
        context.report({ node, messageId: "adapter" });
      }
      if (
        from.layer === "features" &&
        from.slice === "join-event" &&
        to.relative.startsWith("shared/api/")
      ) {
        context.report({ node, messageId: "adapter" });
      }
    }
    return {
      ImportDeclaration: (node) => check(node, node.source.value),
      ExportNamedDeclaration: (node) =>
        node.source && check(node, node.source.value),
      ExportAllDeclaration: (node) => check(node, node.source.value),
      ImportExpression: (node) => check(node, node.source.value),
    };
  },
};
