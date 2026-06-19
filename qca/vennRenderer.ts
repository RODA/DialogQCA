import { VENN_GEOMETRY } from './vennGeometry';

type VennPayload = {
  conditions?: string[];
  ids?: string[];
  out?: string[];
  cases?: string[];
  showCustom?: boolean;
  customText?: string;
};

type VennShapeGeometry = [number[][], number[][]];

interface VennLabelGeometry {
  x: number[];
  y: number[];
}

type VennShapeKey = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7';
type VennLabelKey = 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7';

const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORS: Record<string, string> = {
  '0': '#ffd885',
  '1': '#96bc72',
  C: '#1c8ac9',
  '?': '#ffffff'
};

const asText = (value: unknown) => String(value ?? '').trim();
const asArray = (value: unknown): string[] => Array.isArray(value) ? value.map((entry) => String(entry ?? '')) : [];
const round = (value: number, digits = 3) => {
  const pow = 10 ** digits;
  return Math.round(value * pow) / pow;
};
const countOccurrences = (items: number[]) => {
  const counts = new Map<number, number>();
  items.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return counts;
};

function svgEl<K extends keyof SVGElementTagNameMap>(name: K, attrs?: Record<string, string | number>) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    el.setAttribute(key, String(value));
  });
  return el;
}

function getShape(parts: number[][], venn: number[][], scale: number) {
  let bigPath = '';
  for (const segment of parts) {
    let path = 'M';
    const used = new Array(segment.length).fill(false);
    let end = '';
    let counter = 0;
    while (counter < 1000) {
      for (let i = 0; i < used.length; i += 1) {
        if (used[i]) continue;
        const y = venn[segment[i]] || [];
        if (i === 0) {
          for (let j = 0; j < y.length / 2; j += 1) {
            path += `${j === 1 ? ' C' : ''} ${round(y[2 * j] * scale)},${round(y[2 * j + 1] * scale)}`;
          }
          used[i] = true;
          end = `${y[y.length - 2]} ${y[y.length - 1]}`;
        } else {
          const startBit = `${y[0]} ${y[1]}`;
          const endBit = `${y[y.length - 2]} ${y[y.length - 1]}`;
          if (end === startBit) {
            for (let j = 1; j < y.length / 2; j += 1) {
              path += ` ${round(y[2 * j] * scale)},${round(y[2 * j + 1] * scale)}`;
            }
            used[i] = true;
            end = endBit;
          } else if (end === endBit) {
            for (let j = y.length / 2 - 2; j >= 0; j -= 1) {
              path += ` ${round(y[2 * j] * scale)},${round(y[2 * j + 1] * scale)}`;
            }
            used[i] = true;
            end = startBit;
          }
        }
      }
      if (used.every(Boolean)) break;
      counter += 1;
    }
    bigPath += ` ${path} z`;
  }
  return bigPath.trim();
}

function pathCentroid(pathNode: SVGPathElement) {
  const xs: number[] = [];
  const ys: number[] = [];
  let areaSum = 0;
  let cxSum = 0;
  let cySum = 0;
  const total = pathNode.getTotalLength();
  for (let i = 0; i < 11; i += 1) {
    const point = pathNode.getPointAtLength((i * total) / 10);
    xs.push(point.x);
    ys.push(point.y);
    if (i > 0) {
      const cross = xs[i - 1] * ys[i] - xs[i] * ys[i - 1];
      areaSum += cross;
      cxSum += (xs[i - 1] + xs[i]) * cross;
      cySum += (ys[i - 1] + ys[i]) * cross;
    }
  }
  if (!areaSum) return { x: 0, y: 0 };
  return {
    x: cxSum / (3 * areaSum),
    y: cySum / (3 * areaSum)
  };
}

function parseText(text: string, conditions: string[]) {
  let normalized = String(text || '').replace(/[()]/g, '').replace(/\s/g, '');
  const parsedPlus = normalized.split('+').filter(Boolean);
  let splitChar = '*';
  const validate = (parts: string[]) => {
    return parts.every((token) => {
      let one = token;
      if (one.startsWith('~')) one = one.slice(1);
      const upper = one.toUpperCase();
      const lower = one.toLowerCase();
      if (one !== upper && one !== lower) return false;
      return conditions.includes(upper);
    });
  };
  if (!parsedPlus.every((expr) => validate(expr.split(splitChar).filter(Boolean)))) {
    splitChar = '';
    if (!parsedPlus.every((expr) => validate(expr.split(splitChar).filter(Boolean)))) {
      return 'error';
    }
  }
  const out: Record<string, string> = {};
  parsedPlus.forEach((expr) => {
    const parsed = expr.split(splitChar).filter(Boolean);
    const upper = parsed.map((token) => token.startsWith('~') ? token.slice(1).toUpperCase() : token.toUpperCase());
    let rule = '';
    conditions.forEach((condition) => {
      const index = upper.indexOf(condition);
      if (index < 0) {
        rule += '-';
        return;
      }
      rule += parsed[index] === upper[index] ? '1' : '0';
    });
    out[expr] = rule;
  });
  return out;
}

function customShape(
  rule: string,
  venn: VennShapeGeometry,
  ids: string[],
  scale: number
) {
  const chars = rule.split('');
  let rowns: number[] = [];
  const keys = ids.map((_, index) => index);

  for (let i = 0; i < keys.length; i += 1) {
    const idis = String(ids[keys[i]] || '').split('');
    const check = new Array(chars.length).fill(true);
    for (let j = 0; j < chars.length; j += 1) {
      if (chars[j] !== '-') {
        check[j] = idis.includes(String(j + 1));
        if (chars[j] === '0') check[j] = !check[j];
      }
    }
    if (check.every(Boolean)) {
      rowns[rowns.length] = i;
    }
  }

  const inverted = rowns.includes(0);
  if (rowns.length === 1 && rowns[0] === 0) {
    rowns = ids.map((_, index) => index).filter((index) => index !== 0);
  }

  const checkZone = (from: number, rows: number[], checkz: boolean[]): boolean[] => {
    const fromz = (venn[1][from] || []) as number[];
    const toz: number[] = [];

    for (let i = 0; i < rows.length; i += 1) {
      if (!checkz[i]) {
        const candidate = (venn[1][rows[i]] || []) as number[];
        if (fromz.some((segment) => candidate.includes(segment))) {
          checkz[i] = true;
          toz.push(rows[i]);
        }
      }
    }

    if (toz.length > 0) {
      for (let j = 0; j < toz.length; j += 1) {
        const nextCheck = checkZone(toz[j], rows, checkz.slice());
        for (let i = 0; i < checkz.length; i += 1) {
          checkz[i] = checkz[i] || nextCheck[i];
        }
      }
    }

    return checkz;
  };

  const result: number[][] = [];
  if (rowns.length > 1) {
    let checkz = new Array(rowns.length).fill(false);
    checkz[0] = true;

    while (checkz.some((value) => !value)) {
      checkz = checkZone(rowns[0], rowns, checkz);
      const temp1: number[] = [];
      const temp2: number[] = [];
      const checkz2: boolean[] = [];

      for (let i = 0; i < rowns.length; i += 1) {
        if (checkz[i]) temp1[temp1.length] = rowns[i];
        else {
          temp2[temp2.length] = rowns[i];
          checkz2[checkz2.length] = false;
        }
      }

      result[result.length] = temp1;
      if (checkz2.length > 0) {
        rowns = temp2.slice();
        checkz = checkz2.slice();
        checkz[0] = true;
      }
    }
  } else {
    result[0] = rowns.slice();
  }

  for (let i = 0; i < result.length; i += 1) {
    let temp = ((venn[1][result[i][0]] || []) as number[]).slice();
    if (result[i].length > 1) {
      for (let j = 1; j < result[i].length; j += 1) {
        temp = temp.concat((venn[1][result[i][j]] || []) as number[]);
      }
    }
    const counts = countOccurrences(temp);
    result[i] = temp.filter((segment) => counts.get(segment) === 1);
  }

  return {
    path: getShape(result, venn[0], scale),
    inverted
  };
}

export function renderVennDiagram(host: HTMLElement, payload: VennPayload) {
  host.innerHTML = '';
  const conditions = asArray(payload.conditions).map((item) => item.trim()).filter(Boolean);
  const ids = asArray(payload.ids);
  const out = asArray(payload.out);
  const cases = asArray(payload.cases);
  const count = conditions.length;
  const customText = asText(payload.customText);
  const parsedCustom = (payload.showCustom && customText)
    ? parseText(customText, conditions.map((item) => item.toUpperCase()))
    : null;
  const customMode = !!payload.showCustom;
  const shapeKey = `s${count}` as VennShapeKey;
  const labelKey = `l${count}` as VennLabelKey;
  const shapeData = VENN_GEOMETRY[shapeKey] as VennShapeGeometry | undefined;
  const labelData = VENN_GEOMETRY[labelKey] as VennLabelGeometry | undefined;

  const width = Math.max(1, host.clientWidth || 400);
  const height = Math.max(1, host.clientHeight || 400);
  const scale = Math.min(width, height) / 1000;
  const offsetX = Math.round((width - 1000 * scale) / 2);
  const offsetY = Math.round((height - 1000 * scale) / 2);

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height
  });
  svg.style.display = 'block';
  host.appendChild(svg);

  if (!shapeData || !labelData || count < 1 || count > 7) {
    const text = svgEl('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', 'font-size': 14, fill: '#666666' });
    text.textContent = 'Select a truth table with 1-7 conditions';
    svg.appendChild(text);
    return;
  }

  const group = svgEl('g', { transform: `translate(${offsetX}, ${offsetY})` });
  svg.appendChild(group);

  const coloredGroup = svgEl('g');
  const hoverGroup = svgEl('g');
  const borderGroup = svgEl('g');
  const labelsGroup = svgEl('g');
  const overlayGroup = svgEl('g');
  group.appendChild(coloredGroup);
  group.appendChild(hoverGroup);
  group.appendChild(borderGroup);
  group.appendChild(labelsGroup);
  group.appendChild(overlayGroup);

  let activeGlow: SVGPathElement | null = null;
  let activeTooltip: SVGGElement | null = null;

  const clearHover = () => {
    if (activeGlow && activeGlow.parentNode) activeGlow.parentNode.removeChild(activeGlow);
    if (activeTooltip && activeTooltip.parentNode) activeTooltip.parentNode.removeChild(activeTooltip);
    activeGlow = null;
    activeTooltip = null;
  };

  const showHover = (pathDef: string, hoverText: string, hoverPath: SVGPathElement) => {
    if (!hoverText) return;
    clearHover();

    activeGlow = svgEl('path', {
      d: pathDef,
      fill: 'none',
      stroke: '#0000ff',
      'stroke-width': 2
    });
    overlayGroup.appendChild(activeGlow);

    const bbox = hoverPath.getBBox();
    let xcoord = bbox.x;
    let ycoord = bbox.y - 20;
    if (ycoord < 0) {
      xcoord = bbox.x + 20;
      ycoord = bbox.y + 20;
    }

    const maxWidth = 200;
    const words = hoverText.split(',').join(', ').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    const measure = svgEl('text', {
      'font-size': 14,
      'font-weight': 700,
      'text-anchor': 'start'
    });
    overlayGroup.appendChild(measure);
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      measure.textContent = candidate;
      const widthNow = measure.getComputedTextLength();
      if (current && widthNow > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });
    if (current) lines.push(current);
    if (!lines.length) lines.push(hoverText);
    overlayGroup.removeChild(measure);

    const tooltipGroup = svgEl('g');
    const textEl = svgEl('text', {
      x: xcoord,
      y: ycoord,
      'font-size': 14,
      'font-weight': 700,
      'text-anchor': 'start',
      fill: '#000000'
    });
    lines.forEach((line, index) => {
      const tspan = svgEl('tspan', {
        x: xcoord,
        dy: index === 0 ? 0 : 16
      });
      tspan.textContent = line;
      textEl.appendChild(tspan);
    });
    tooltipGroup.appendChild(textEl);
    overlayGroup.appendChild(tooltipGroup);
    const textBox = textEl.getBBox();
    const bg = svgEl('rect', {
      x: textBox.x - 8,
      y: textBox.y - 4,
      width: textBox.width + 16,
      height: textBox.height + 8,
      fill: '#c9c9c9',
      'fill-opacity': 0.8,
      stroke: 'none'
    });
    tooltipGroup.insertBefore(bg, textEl);
    activeTooltip = tooltipGroup;
    if (activeGlow.parentNode) activeGlow.parentNode.appendChild(activeGlow);
    if (activeTooltip.parentNode) activeTooltip.parentNode.appendChild(activeTooltip);
  };

  shapeData[0].forEach((segment) => {
    let path = 'M';
    for (let j = 0; j < segment.length / 2; j += 1) {
      path += `${j === 1 ? ' C' : ''} ${round(segment[2 * j] * scale)},${round(segment[2 * j + 1] * scale)}`;
    }
    const borderPath = svgEl('path', { d: path, fill: 'none', stroke: '#000000', 'stroke-width': 1 });
    borderGroup.appendChild(borderPath);
  });

  ids.forEach((id, index) => {
    if (index >= (shapeData[1] || []).length) return;
    let d = getShape([shapeData[1][index]], shapeData[0], scale);
    if (index === 0) {
      d = `M 0,0 0,${1000 * scale} ${1000 * scale},${1000 * scale} ${1000 * scale},0 0,0 z ${d}`;
    }
    if (!customMode) {
      const fill = COLORS[String(out[index] || '?')] || '#ffffff';
      const path = svgEl('path', { d, fill, stroke: 'none' });
      coloredGroup.appendChild(path);
    }

    const pathForCentroid = svgEl('path', { d });
    const centroid = pathCentroid(pathForCentroid);
    if (ids.length === 16) {
      if (index === 1) {
        centroid.x += 20 * scale;
        centroid.y -= 75 * scale;
      } else if (index === 8) {
        centroid.x -= 20 * scale;
        centroid.y -= 75 * scale;
      }
    }
    const text = svgEl('text', {
      x: index === 0 ? 20 : round(centroid.x),
      y: index === 0 ? 20 : round(centroid.y),
      'text-anchor': 'middle',
      'font-size': 8,
      fill: '#000000'
    });
    text.textContent = String(id || '');
    labelsGroup.appendChild(text);

    const hoverText = String(cases[index] || '');
    if (!customMode && hoverText) {
      const hoverPath = svgEl('path', { d, fill: '#ffffff', 'fill-opacity': 0, stroke: 'none' });
      hoverPath.addEventListener('mouseenter', () => showHover(d, hoverText, hoverPath));
      hoverPath.addEventListener('mouseleave', clearHover);
      hoverGroup.appendChild(hoverPath);
    }
  });

  conditions.forEach((condition, index) => {
    const text = svgEl('text', {
      x: round((labelData.x[index] || 0) * scale),
      y: round((labelData.y[index] || 0) * scale),
      'text-anchor': 'middle',
      'font-size': 14,
      'font-weight': 700,
      fill: '#000000'
    });
    text.textContent = condition;
    labelsGroup.appendChild(text);
  });

  if (customMode && parsedCustom && parsedCustom !== 'error') {
      const customGroup = svgEl('g');
      const customHoverGroup = svgEl('g');
      Object.keys(parsedCustom).forEach((key) => {
        const result = customShape(parsedCustom[key], shapeData, ids, scale);
        let d = result.path;
        if (result.inverted) {
          d = `M 0,0 0,${1000 * scale} ${1000 * scale},${1000 * scale} ${1000 * scale},0 0,0 z ${d}`;
        }
        const path = svgEl('path', {
          d,
          fill: '#96bc72',
          'fill-opacity': 0.75,
          stroke: 'none'
        });
        customGroup.appendChild(path);
        const hoverPath = svgEl('path', { d, fill: '#ffffff', 'fill-opacity': 0, stroke: 'none' });
        hoverPath.addEventListener('mouseenter', () => showHover(d, key, hoverPath));
        hoverPath.addEventListener('mouseleave', clearHover);
        customHoverGroup.appendChild(hoverPath);
      });
      group.appendChild(customGroup);
      group.appendChild(customHoverGroup);
      borderGroup.parentNode?.appendChild(borderGroup);
      labelsGroup.parentNode?.appendChild(labelsGroup);
  }

  group.appendChild(hoverGroup);
  group.appendChild(borderGroup);
  group.appendChild(labelsGroup);
  group.appendChild(overlayGroup);
}


export const qcaVennRendererApi = {
    renderVennDiagram
};
