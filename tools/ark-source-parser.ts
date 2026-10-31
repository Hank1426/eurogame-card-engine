import ts from 'typescript';

export type Literal = string | number | boolean | null | Literal[] | { [key: string]: Literal };
export type EnumTable = Map<string, Map<string, Literal>>;

export function parseEnums(files: string[]): EnumTable {
  const table: EnumTable = new Map();
  for (const text of files) {
    const source = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isEnumDeclaration(statement)) continue;
      const members = new Map<string, Literal>();
      let nextValue = 0;
      for (const member of statement.members) {
        const name = member.name.getText(source).replace(/^['"]|['"]$/g, '');
        const value = member.initializer ? parseLiteral(member.initializer, table) : nextValue;
        members.set(name, value);
        if (typeof value === 'number') nextValue = value + 1;
      }
      table.set(statement.name.text, members);
    }
  }
  for (const text of files) {
    const source = ts.createSourceFile('types.ts', text, ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement) || statement.name?.text !== 'KeyWord') continue;
      const members = new Map<string, Literal>();
      for (const member of statement.members) {
        if (!ts.isPropertyDeclaration(member) || !member.initializer || !ts.isIdentifier(member.name) ||
          !member.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword)) continue;
        if (!ts.isNewExpression(member.initializer) || !ts.isIdentifier(member.initializer.expression) ||
          member.initializer.expression.text !== 'KeyWord') throw new Error('关键词必须使用声明式 KeyWord 定义。');
        members.set(member.name.text, {
          kind: 'KeyWord',
          key: member.name.text,
          arguments: (member.initializer.arguments ?? []).slice(0, 2).map(argument => parseLiteral(argument, table)),
          omittedModelArguments: Math.max(0, (member.initializer.arguments?.length ?? 0) - 2)
        });
      }
      table.set('KeyWord', members);
    }
  }
  return table;
}

export function parseLiteral(node: ts.Expression, enums: EnumTable): Literal {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(node) && node.text === 'NaN') return { kind: 'non-finite', value: 'NaN' };
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(element => {
    if (ts.isSpreadElement(element)) throw new Error('数据数组不支持展开运算。');
    return parseLiteral(element, enums);
  });
  if (ts.isObjectLiteralExpression(node)) {
    const pairs = node.properties.map(property => {
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) throw new Error('数据对象仅允许普通属性。');
      const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name) ? property.name.text : null;
      if (!name || ['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('不支持的属性名。');
      return [name, parseLiteral(property.initializer, enums)] as const;
    });
    if (new Set(pairs.map(([name]) => name)).size !== pairs.length) throw new Error('数据对象包含重复属性。');
    return Object.fromEntries(pairs);
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const value = enums.get(node.expression.text)?.get(node.name.text);
    if (value === undefined) throw new Error(`未知枚举：${node.expression.text}.${node.name.text}`);
    return value;
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && ['Ability', 'SpecialEnclosure', 'KeyWord'].includes(node.expression.text)) {
    return { kind: node.expression.text, arguments: (node.arguments ?? []).map(argument => parseLiteral(argument, enums)) };
  }
  throw new Error(`不执行上游代码：不支持 ${ts.SyntaxKind[node.kind]} (${node.getText().slice(0, 80)})。`);
}

export function parseExport(text: string, exportName: string, enums: EnumTable): Literal[] {
  const source = ts.createSourceFile('data.ts', text, ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === exportName && declaration.initializer) {
        const result = parseLiteral(declaration.initializer, enums);
        if (!Array.isArray(result)) throw new Error(`${exportName} 应为数组。`);
        return result;
      }
    }
  }
  throw new Error(`找不到 ${exportName}。`);
}
