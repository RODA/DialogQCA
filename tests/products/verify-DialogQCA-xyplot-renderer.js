"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const { renderXYPlot } = require("../../qca/xyPlotRenderer");
class FakeSvgElement {
    constructor(tagName) {
        this.attributes = {};
        this.children = [];
        this.textContent = "";
        this.style = {};
        this.tagName = tagName;
    }
    setAttribute(name, value) {
        this.attributes[name] = value;
    }
    appendChild(child) {
        this.children.push(child);
        return child;
    }
}
class FakeHost extends FakeSvgElement {
    constructor() {
        super(...arguments);
        this.clientWidth = 320;
        this.clientHeight = 220;
    }
}
global.document = {
    createElementNS: function (_namespace, tagName) {
        return new FakeSvgElement(tagName);
    }
};
const host = new FakeHost("div");
renderXYPlot(host, {
    xAxisLabel: "A",
    yAxisLabel: "B",
    points: [
        { x: 0.2, y: 0.8, label: "case1" },
        { x: 0.5, y: 0.4, label: "case2" }
    ],
    fitLabels: ["Inclusion: 0.9", "Coverage: 0.8"]
});
assert.strictEqual(host.children.length, 1);
assert.strictEqual(host.children[0].tagName, "svg");
assert.strictEqual(host.children[0].children.filter((child) => {
    return child.tagName === "circle";
}).length, 2);
assert.ok(host.children[0].children.some((child) => {
    return child.tagName === "text" && child.textContent === "Inclusion: 0.9";
}));
assert.strictEqual(host.children[0].children.filter((child) => {
    return child.tagName === "line" && child.attributes["stroke-dasharray"] === "8 6";
}).length, 2);
assert.strictEqual(host.children[0].children.find((child) => {
    return child.tagName === "circle";
})?.attributes.fill, "#1c8ac9");
const baseCircle = host.children[0].children.find((child) => {
    return child.tagName === "circle";
});
assert.strictEqual(host.children[0].children.filter((child) => {
    return child.children.some((nested) => {
        return nested.tagName === "title";
    });
}).length, 2);
const labeledHost = new FakeHost("div");
renderXYPlot(labeledHost, {
    showGuides: false,
    showCases: true,
    fillPoints: false,
    jitterPoints: true,
    caseLabelRotation: 90,
    points: [
        { x: 0.2, y: 0.8, label: "case1" }
    ]
});
assert.strictEqual(labeledHost.children[0].children.filter((child) => {
    return child.children.some((nested) => {
        return nested.tagName === "title" && nested.textContent === "case1";
    });
}).length, 0);
assert.strictEqual(labeledHost.children[0].children.filter((child) => {
    return child.tagName === "g" && child.attributes.transform.includes("rotate(-90");
}).length, 1);
assert.strictEqual(labeledHost.children[0].children.filter((child) => {
    return child.children.some((nested) => {
        return nested.tagName === "text" && nested.textContent === "case1";
    });
}).length, 1);
assert.strictEqual(labeledHost.children[0].children.find((child) => {
    return child.tagName === "circle";
})?.attributes.fill, "#ffffff");
assert.notStrictEqual(labeledHost.children[0].children.find((child) => {
    return child.tagName === "circle";
})?.attributes.cx, baseCircle?.attributes.cx);
assert.strictEqual(labeledHost.children[0].children.filter((child) => {
    return child.tagName === "line" && child.attributes["stroke-dasharray"] === "8 6";
}).length, 0);
console.log("DialogQCA XY plot renderer verified.");
