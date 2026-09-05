alter table categories add column if not exists sort_order int not null default 0;

-- Backfill existing categories with their current creation order, so
-- nothing appears to shuffle the first time this runs.
with ordered as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as rn
  from categories
)
update categories c set sort_order = ordered.rn
from ordered
where ordered.id = c.id;