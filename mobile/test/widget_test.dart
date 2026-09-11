import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:safelink_ai/main.dart';

void main() {
  for (final width in [320.0, 768.0, 1440.0]) {
    testWidgets('Scanner adapts to width $width', (tester) async {
      tester.view.physicalSize = Size(width, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(SafeLinkApp());
      await tester.pumpAndSettle();
      expect(find.text('SafeLink AI'), findsOneWidget);
      expect(find.text('A safer click starts here.'), findsOneWidget);
      expect(find.text('Scan Now'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('History requires an account', (tester) async {
    await tester.pumpWidget(SafeLinkApp());
    await tester.pumpAndSettle();
    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();
    expect(find.text('Your scan history'), findsOneWidget);
    expect(find.text('Sign in to access your personal workspace.'),
        findsOneWidget);
  });
}
