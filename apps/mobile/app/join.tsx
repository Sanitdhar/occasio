import { isNotFoundError } from '@occasio/data';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAdapter } from '../src/data/AdapterProvider';
import { JoinScreen } from '../src/features/join/JoinScreen';
import { scanJoinCode } from '../src/tenant/scanner';
import { useRecentTenants } from '../src/tenant/useRecentTenants';

/**
 * The route: recents, the lookup, and where a successful join goes.
 *
 * `JoinScreen` holds none of it. Everything below is either the router or the adapter, which is
 * exactly the split this repo's conventions ask for — and it is what lets the screen be rendered
 * in a test with four lines of props.
 */
export default function Route() {
  const adapter = useAdapter();
  const recents = useRecentTenants();

  const join = useMutation({
    mutationFn: (code: string) => adapter.directory.byJoinCode(code),
    onSuccess: (tenant) => {
      /* `replace`, not `push`: the join screen is how somebody got in, not somewhere to go back
         to. Leaving it on the stack means the back gesture from the event lands on a code field. */
      router.replace(`/e/${tenant.slug}`);
    },
  });

  const open = (slug: string) => {
    router.replace(`/e/${slug}`);
  };

  return (
    <JoinScreen
      recents={recents}
      onOpen={open}
      onSubmitCode={(code) => {
        join.mutate(code);
      }}
      submitting={join.isPending}
      error={errorText(join.error)}
      onScan={scanJoinCode ?? undefined}
    />
  );
}

/**
 * What to say under the field.
 *
 * A wrong code is the ordinary case and is the person's to fix, so it says so plainly and does
 * not mention the network. Anything else is ours, and saying "that code is wrong" about a failed
 * request would send somebody to check a card that was right all along.
 */
const errorText = (error: unknown): string | undefined => {
  if (error === null || error === undefined) return undefined;
  return isNotFoundError(error)
    ? 'No event has that code. Check the card — it is easy to lose a character.'
    : 'Could not check that code. It may be the connection.';
};
