exports.handler = (admin, ref, event) => {
  const uid = event.data.uid;
  const email = event.data.email || null;
  const displayName = event.data.displayName || null;
  const photoURL = event.data.photoURL || 'http://www.patriotenergygroup.com/images2/tba.png';

  const newUserRef = ref.child(`/users/${uid}`);

  return newUserRef.set({
    email: email,
    displayName: displayName,
    photoURL: photoURL,
    isWalkthroughComplete: false,
    isProfileComplete: false,
    userType: '',
    ts: admin.database.ServerValue.TIMESTAMP
  });
}