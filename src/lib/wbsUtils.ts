import { WbsNode, WbsNodeWithNumber } from './types';

/**
 * Parses a flat array of WBS nodes into a tree structure and dynamically calculates WBS numbers.
 * The nodes are assumed to be sorted by `order_rank` within each parent.
 */
export function buildWbsTree(nodes: WbsNode[]): WbsNodeWithNumber[] {
  // 1. Group nodes by parent_id and sort them by order_rank
  const nodeMap = new Map<string | null, WbsNode[]>();
  nodes.forEach(node => {
    const parentId = node.parent_id;
    if (!nodeMap.has(parentId)) {
      nodeMap.set(parentId, []);
    }
    nodeMap.get(parentId)!.push(node);
  });

  // Sort children within each group based on LexoRank (string comparison)
  nodeMap.forEach(children => {
    children.sort((a, b) => a.order_rank.localeCompare(b.order_rank));
  });

  // 2. Recursively build the tree and assign WBS numbers
  function traverse(parentId: string | null, prefix: string): WbsNodeWithNumber[] {
    const children = nodeMap.get(parentId) || [];
    return children.map((node, index) => {
      const currentNumber = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      const nodeWithNumber: WbsNodeWithNumber = {
        ...node,
        wbs_number: currentNumber,
      };

      const childNodes = traverse(node.id, currentNumber);
      if (childNodes.length > 0) {
        nodeWithNumber.children = childNodes;
      }
      return nodeWithNumber;
    });
  }

  // Start with root nodes (Level 2 nodes, parent_id is null)
  return traverse(null, '');
}
