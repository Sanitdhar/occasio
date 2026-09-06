import { router } from 'expo-router';
import { JoinScreen } from '../src/features/join/JoinScreen';
import { useJoinFlow } from '../src/features/join/useJoinFlow';
import { scanJoinCode } from '../src/tenant/scanner';

/**
 * The route: where joining leads, and nothing else.
 *
 * `replace`, not `push`, in both places: the join screen is how somebody got in, not somewhere
 * to go back to. Leaving it on the stack means the back gesture from an event lands a guest on a
 * code field.
 */
export default function Route() {
  const open = (slug: string) => {
    router.replace(`/e/${slug}`);
  };

  const { recents, submitCode, submitting, error } = useJoinFlow(open);

  return (
    <JoinScreen
      recents={recents}
      onOpen={open}
      onSubmitCode={submitCode}
      submitting={submitting}
      error={error}
      onScan={scanJoinCode ?? undefined}
    />
  );
}
