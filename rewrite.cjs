const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'pages', 'organizer', 'EditEventPage.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// Replace imports
code = code.replace(
  "import { useNavigate } from 'react-router-dom'",
  "import { useNavigate, useParams } from 'react-router-dom'\nimport { useEffect } from 'react'"
);

// Replace Function Name
code = code.replace("export default function CreateEventPage() {", "export default function EditEventPage() {");

// Add useParams and fetch logic
const fetchLogic = `
  const { eventId } = useParams()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!eventId || !user) return
    const fetchEvent = async () => {
      setLoading(true)
      const { data: event, error } = await supabase
        .from('events')
        .select('*, event_slots(*), custom_fields(*)')
        .eq('id', eventId)
        .single()
      
      if (event && !error) {
        setTitle(event.title)
        setDescription(event.description || '')
        setQueuePrefix((event.settings as any)?.queue_prefix || '')
        setTtsPhrase((event.settings as any)?.tts_phrase || 'ขอเชิญหมายเลข')
        setTtsCallName((event.settings as any)?.tts_call_name ?? true)
        setQueueType(event.queue_type as any)
        if (event.banner_url) setBannerPreview(event.banner_url)
        
        if (event.event_slots && event.event_slots.length > 0) {
          setSlots(event.event_slots.map((s: any) => ({
            id: s.id,
            slot_date: s.slot_date,
            start_time: s.start_time,
            end_time: s.end_time,
            capacity: s.capacity
          })))
        }
        
        if (event.custom_fields && event.custom_fields.length > 0) {
          setFields(event.custom_fields.sort((a: any, b: any) => a.sort_order - b.sort_order).map((f: any) => ({
            id: f.id,
            label: f.label,
            field_type: f.field_type,
            is_required: f.is_required,
            options: f.options
          })))
        }
      }
      setLoading(false)
      setInitialized(true)
    }
    fetchEvent()
  }, [eventId, user])

  if (!initialized && loading) {
    return <div className="create-event-page fade-in"><div className="loading-overlay"><div className="spinner spinner-lg" /></div></div>
  }
`;

code = code.replace("  const navigate = useNavigate()", "  const navigate = useNavigate()\n" + fetchLogic);


// Update Submit logic
const oldSubmit = `      // Create event
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          organizer_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          banner_url: bannerUrl,
          queue_type: queueType,
          status: 'active',
          settings: { 
            queue_prefix: queuePrefix.trim(),
            tts_phrase: ttsPhrase.trim() || 'ขอเชิญหมายเลข',
            tts_call_name: ttsCallName
          },
        })
        .select()
        .single()

      if (eventError) throw new Error('events: ' + eventError.message)

      // Create slots if scheduled
      if (queueType === 'scheduled' && slots.length > 0) {
        const { error: slotsError } = await supabase.from('event_slots').insert(
          slots.map(s => ({
            event_id: event.id,
            slot_date: s.slot_date,
            start_time: s.start_time,
            end_time: s.end_time,
            capacity: s.capacity,
            booked_count: 0
          }))
        )
        if (slotsError) throw new Error('event_slots: ' + slotsError.message)
      }

      // Create custom fields
      const customFields = fields.filter(f => f.label.trim() !== '')
      if (customFields.length > 0) {
        const { error: fieldsError } = await supabase.from('custom_fields').insert(
          customFields.map((f, idx) => ({
            event_id: event.id,
            label: f.label.trim(),
            field_type: f.field_type,
            is_required: f.is_required,
            options: f.options,
            sort_order: idx,
          }))
        )
        if (fieldsError) throw new Error('custom_fields: ' + fieldsError.message)
      }

      // Create queue session
      const { error: qsError } = await supabase.from('queue_sessions').insert({
        event_id: event.id,
        current_numbers: [],
        call_count_per_round: 1,
        show_name: true,
        language: 'th',
      })
      if (qsError) throw new Error('queue_sessions: ' + qsError.message)`;

const newSubmit = `      // Update event
      const eventUpdatePayload: any = {
        title: title.trim(),
        description: description.trim() || null,
        queue_type: queueType,
        settings: { 
          queue_prefix: queuePrefix.trim(),
          tts_phrase: ttsPhrase.trim() || 'ขอเชิญหมายเลข',
          tts_call_name: ttsCallName
        },
      }
      if (bannerFile) {
        eventUpdatePayload.banner_url = bannerUrl
      } else if (!bannerPreview) {
        eventUpdatePayload.banner_url = null
      }

      const { error: eventError } = await supabase
        .from('events')
        .update(eventUpdatePayload)
        .eq('id', eventId)

      if (eventError) throw new Error('events: ' + eventError.message)

      // Upsert slots if scheduled
      if (queueType === 'scheduled' && slots.length > 0) {
        const { error: slotsError } = await supabase.from('event_slots').upsert(
          slots.map(s => ({
            id: s.id,
            event_id: eventId,
            slot_date: s.slot_date,
            start_time: s.start_time,
            end_time: s.end_time,
            capacity: s.capacity,
            status: 'open'
          })),
          { onConflict: 'id' }
        )
        if (slotsError) throw new Error('event_slots: ' + slotsError.message)
        
        // delete removed slots
        const activeSlotIds = slots.map(s => s.id)
        await supabase.from('event_slots').delete().eq('event_id', eventId).not('id', 'in', '(' + activeSlotIds.join(',') + ')')
      }

      // Upsert custom fields
      const customFields = fields.filter(f => f.label.trim() !== '')
      if (customFields.length > 0) {
        const { error: fieldsError } = await supabase.from('custom_fields').upsert(
          customFields.map((f, idx) => ({
            id: f.id,
            event_id: eventId,
            label: f.label.trim(),
            field_type: f.field_type,
            is_required: f.is_required,
            options: f.options,
            sort_order: idx,
          })),
          { onConflict: 'id' }
        )
        if (fieldsError) throw new Error('custom_fields: ' + fieldsError.message)
        
        // delete removed fields
        const activeFieldIds = customFields.map(f => f.id)
        await supabase.from('custom_fields').delete().eq('event_id', eventId).not('id', 'in', '(' + activeFieldIds.join(',') + ')')
      }`;

code = code.replace(oldSubmit, newSubmit);

// Change titles
code = code.replace(/สร้างกิจกรรมใหม่/g, "แก้ไขกิจกรรม");
code = code.replace(/สร้างกิจกรรมสำเร็จ!/g, "บันทึกการแก้ไขสำเร็จ!");
code = code.replace(/'🎉 สร้างกิจกรรม'/g, "'💾 บันทึกการแก้ไข'");

// Fix navigate success
code = code.replace("navigate(`/organizer/events/${event.id}`)", "navigate(`/organizer/events/${eventId}`)");

fs.writeFileSync(filePath, code);
console.log("Done modifying EditEventPage.tsx");
