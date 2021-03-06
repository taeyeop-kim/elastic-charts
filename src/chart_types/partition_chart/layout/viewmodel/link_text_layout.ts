import { Distance } from '../types/geometry_types';
import { Config } from '../types/config_types';
import { TAU, trueBearingToStandardPositionAngle } from '../utils/math';
import { LinkLabelVM, ShapeTreeNode, ValueFormatter } from '../types/viewmodel_types';
import { meanAngle } from '../geometry';
import { TextMeasure } from '../types/types';
import { AGGREGATE_KEY } from '../utils/group_by_rollup';

// todo modularize this large function
export function linkTextLayout(
  measure: TextMeasure,
  config: Config,
  nodesWithoutRoom: ShapeTreeNode[],
  currentY: Distance[],
  anchorRadius: Distance,
  rawTextGetter: Function,
  valueFormatter: ValueFormatter,
): LinkLabelVM[] {
  const { linkLabel } = config;
  const maxDepth = nodesWithoutRoom.reduce((p: number, n: ShapeTreeNode) => Math.max(p, n.depth), 0);
  const yRelativeIncrement = Math.sin(linkLabel.stemAngle) * linkLabel.minimumStemLength;
  const rowPitch = linkLabel.fontSize + linkLabel.spacing;
  return nodesWithoutRoom
    .filter((n: ShapeTreeNode) => n.depth === maxDepth) // only the outermost ring can have links
    .sort((n1: ShapeTreeNode, n2: ShapeTreeNode) => Math.abs(n2.x0 - n2.x1) - Math.abs(n1.x0 - n1.x1))
    .slice(0, linkLabel.maxCount) // largest linkLabel.MaxCount slices
    .sort((n1: ShapeTreeNode, n2: ShapeTreeNode) => {
      const mid1 = meanAngle(n1.x0, n1.x1);
      const mid2 = meanAngle(n2.x0, n2.x1);
      const dist1 = Math.min(Math.abs(mid1 - TAU / 4), Math.abs(mid1 - (3 * TAU) / 4));
      const dist2 = Math.min(Math.abs(mid2 - TAU / 4), Math.abs(mid2 - (3 * TAU) / 4));
      return dist1 - dist2;
    })
    .map((node: ShapeTreeNode) => {
      const midAngle = trueBearingToStandardPositionAngle(meanAngle(node.x0, node.x1));
      const north = midAngle < TAU / 2 ? 1 : -1;
      const side = TAU / 4 < midAngle && midAngle < (3 * TAU) / 4 ? 0 : 1;
      const west = side ? 1 : -1;
      const cos = Math.cos(midAngle);
      const sin = Math.sin(midAngle);
      const x0 = cos * anchorRadius;
      const y0 = sin * anchorRadius;
      const x = cos * (anchorRadius + linkLabel.radiusPadding);
      const y = sin * (anchorRadius + linkLabel.radiusPadding);
      const poolIndex = side + (1 - north);
      const relativeY = north * y;
      currentY[poolIndex] = Math.max(currentY[poolIndex] + rowPitch, relativeY + yRelativeIncrement, rowPitch / 2);
      const cy = north * currentY[poolIndex];
      const stemFromX = x;
      const stemFromY = y;
      const stemToX = x + north * west * cy - west * relativeY;
      const stemToY = cy;
      const text = rawTextGetter(node);
      const { width, emHeightAscent, emHeightDescent } = measure(linkLabel.fontSize, [
        { fontFamily: config.fontFamily, ...linkLabel, text },
      ])[0];
      return {
        link: [
          [x0, y0],
          [stemFromX, stemFromY],
          [stemToX, stemToY],
          [stemToX + west * linkLabel.horizontalStemLength, stemToY],
        ],
        translate: [stemToX + west * (linkLabel.horizontalStemLength + linkLabel.gap), stemToY],
        textAlign: side ? 'left' : 'right',
        text,
        valueText: valueFormatter(node[AGGREGATE_KEY]),
        width,
        verticalOffset: -(emHeightDescent + emHeightAscent) / 2, // meaning, `middle`
      };
    });
}
