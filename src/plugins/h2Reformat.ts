import { visit } from 'unist-util-visit';

export default function h2Reformat() {
  return (tree: any) => {
    const insertions: Array<{ parent: any; index: number }> = [];

    // First, collect all the positions where the hrNode should be inserted
    visit(tree, 'heading', (node: any, index: number | undefined, parent: any) => {
      if (node.depth === 2 && parent && Array.isArray(parent.children) && index !== undefined) {
        insertions.push({ parent, index });
      }
    });

    // Insert hrNodes in reverse order to prevent index shifting issues
    for (let i = insertions.length - 1; i >= 0; i--) {
      const { parent, index } = insertions[i];
      const hrNode = { type: 'thematicBreak' };
      parent.children.splice(index, 0, hrNode);
    }
  };
}
