// Single source of truth for employee permission keys. Mirrored on the backend
// in `src/middleware/permission.middleware.js`.
//
// Two flavours of keys for each tab:
//   - <tab>         → can VIEW the tab (sidebar visibility)
//   - <tab>.write   → can CREATE / EDIT / DELETE inside the tab
//
// Admins always have everything. New employees get ALL_PERMISSIONS by default.

export const PERMISSION_GROUPS = [
  { key: 'overview',       label: 'Overview',           write: false },
  { key: 'products',       label: 'Products',           write: true  },
  { key: 'orders',         label: 'Orders',             write: true  },
  { key: 'returns',        label: 'Returns',            write: true  },
  { key: 'cancellations',  label: 'Cancellations',      write: true  },
  { key: 'deliveryAreas',  label: 'Delivery Areas',     write: true  },
  { key: 'coupons',        label: 'Coupons',            write: true  },
  { key: 'support',        label: 'Support Tickets',    write: true  },
  { key: 'salary',         label: 'My Salary',          write: false },
  { key: 'catalog',        label: 'Catalog',            write: true  },
  { key: 'banners',        label: 'Banners',            write: true  },
  { key: 'settings',       label: 'Settings',           write: true  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g =>
  g.write ? [g.key, `${g.key}.write`] : [g.key]
);

// Default for newly-created employees — every tab + every write action.
export const DEFAULT_PERMISSIONS = ALL_PERMISSIONS;

// Returns true if the employee (or admin) has every listed permission key.
// Pass the raw permissions array from the user/employee profile.
export const hasPermission = (perms, ...required) => {
  if (!perms) return false;
  // If `perms` is undefined-but-not-array (e.g. user is admin), treat as full access.
  if (perms === '*') return true;
  return required.every(k => perms.includes(k));
};
