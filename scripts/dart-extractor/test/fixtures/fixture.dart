// Self-contained fixture — no imports, no Flutter dependencies.
// Mirrors real Flutter patterns for testing the extractor.

abstract class Widget {}

enum TestEnum { alpha, beta, gamma }

class TestWidget extends Widget {
  const TestWidget({
    required this.label,
    this.count = 0,
    this.child,
    this.children,
    this.alignment = TestEnum.alpha,
    this.formatter,
    this.visible,
    this.key,
  });

  final String label;
  final int count;
  final Widget? child;
  final List<Widget>? children;
  final TestEnum alignment;
  final String Function(int)? formatter;
  final bool? visible;
  final Key? key;
}

abstract class AbstractWidget extends Widget {
  const AbstractWidget();
}

class NotAWidget {
  const NotAWidget({this.value = 0});
  final int value;
}

class Key {}
