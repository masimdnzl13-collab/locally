-- Admin paneli: işletme askıya alma durumu ve admin tarafından
-- kaldırılan içeriği işletmeciye ayırt ettirecek işaretler.

alter type approval_status add value 'suspended';

alter table businesses add column suspend_reason text;

alter table packages add column removed_by_admin boolean not null default false;
alter table flash_deals add column removed_by_admin boolean not null default false;
alter table events add column removed_by_admin boolean not null default false;
