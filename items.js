
const defaultItems = [
  { key: 'steel', name: 'Steel' },
  { key: 'concrete', name: 'Concrete' },
  { key: 'labor', name: 'Labour' },
  { key: 'other', name: 'Other' },
];

function getItems(project) {
  return project.items ?? defaultItems;
}

function itemName(item) {
  return defaultItems.some((entry) => entry.key === item.key && entry.name === item.name)
    ? t(item.name) : item.name;
}
