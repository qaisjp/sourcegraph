load("@with_cfg.bzl", "with_cfg")
load("@rules_oci//oci:defs.bzl", base_oci_image = "oci_image")

_builder = with_cfg(base_oci_image)
_builder.set("platforms", [Label("@zig_sdk//platform:linux_amd64")])

oci_image, _oci_image_internal = _builder.build()
