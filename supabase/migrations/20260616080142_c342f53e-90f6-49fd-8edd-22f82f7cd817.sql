CREATE POLICY "citizens read assigned officer profile" ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.complaints c WHERE c.assigned_officer_id = profiles.id AND c.citizen_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.service_applications s WHERE s.assigned_officer_id = profiles.id AND s.citizen_id = auth.uid())
);