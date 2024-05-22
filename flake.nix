{
  description = "Tangle Network payout tools";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "tangle-payouts";
          nativeBuildInputs = [ ];
          buildInputs = [ ];
          packages = [
            pkgs.deno
          ];
        };
      });
}
