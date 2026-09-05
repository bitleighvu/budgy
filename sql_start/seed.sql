insert into users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'you@example.com')
on conflict (id) do nothing;

insert into categories (id, user_id, name, color_idx) values
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Groceries',0),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Dining Out',1),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Transport',2),
  ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','Entertainment',3),
  ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','Subscriptions',4)
on conflict (id) do nothing;

-- Budgets are left for you to set from the dashboard (tap a budget number
-- to edit it) since they're scoped to the current calendar month.
