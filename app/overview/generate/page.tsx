import GenerateHeadshotsZone from "@/components/GenerateHeadshotsZone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";

export default function GeneratePage() {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="flex flex-1 flex-col gap-2 px-2">
        <Link href="/overview" className="text-sm w-fit">
          <Button variant="outline">
            <FaArrowLeft className="mr-2" />
            Go Back
          </Button>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>New headshot shoot</CardTitle>
            <CardDescription>
              Choose an AI model and styles, then upload a few photos of yourself.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GenerateHeadshotsZone />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
