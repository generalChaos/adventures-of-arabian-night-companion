-- Allow authenticated game members to subscribe to private game topics.
-- Topic shape: game:<uuid>

create policy "authenticated users can receive realtime messages"
  on realtime.messages
  for select
  to authenticated
  using (true);

create policy "authenticated users can broadcast realtime messages"
  on realtime.messages
  for insert
  to authenticated
  with check (true);
