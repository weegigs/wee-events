{
  description = "Terminal Deployment Environment";

  inputs = {
    # nixpkgs.url = "github:NixOS/nixpkgs";
    unstable.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

 outputs = { self, flake-utils, unstable }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import unstable { inherit system; };
      in
    {
      devShell = pkgs.mkShell {
        packages = with pkgs; [
          nodejs-16_x
          nodePackages.pnpm
          nodePackages.lerna
          sops
        ];
      };
    }
    );
}
