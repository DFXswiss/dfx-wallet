export type GroupedAddressValue = {
  original: string;
  groups: string[];
  lines: string[];
  accessibilityLabel: string;
  emphasizedStart: string;
  emphasizedEnd: string;
};

const GROUP_SIZE = 4;

const renderedLength = (groups: string[]): number =>
  groups.reduce((length, group) => length + group.length, 0) + Math.max(0, groups.length - 1);

function balancedSplit(groups: string[]): number {
  if (groups.length < 2) return groups.length;

  let bestIndex = 1;
  let bestDifference = Number.POSITIVE_INFINITY;

  for (let index = 1; index < groups.length; index += 1) {
    const difference = Math.abs(
      renderedLength(groups.slice(0, index)) - renderedLength(groups.slice(index)),
    );
    if (difference < bestDifference) {
      bestIndex = index;
      bestDifference = difference;
    }
  }

  return bestIndex;
}

export function groupAddress(address: string): GroupedAddressValue {
  const initialGroups = address.match(/.{1,4}/g) ?? [];
  const trailingGroup = initialGroups[initialGroups.length - 1];
  const hasShortTrailingGroup =
    initialGroups.length > 1 && trailingGroup !== undefined && trailingGroup.length < GROUP_SIZE;
  const groups = hasShortTrailingGroup
    ? [...initialGroups.slice(0, -2), initialGroups.slice(-2).join('')]
    : initialGroups;
  const splitIndex = balancedSplit(groups);
  const lines =
    groups.length > 1
      ? [groups.slice(0, splitIndex).join(' '), groups.slice(splitIndex).join(' ')]
      : [groups.join(' ')];

  return {
    original: address,
    groups,
    lines,
    accessibilityLabel: groups.join(' '),
    emphasizedStart: address.slice(0, GROUP_SIZE),
    emphasizedEnd: groups[groups.length - 1] ?? '',
  };
}
